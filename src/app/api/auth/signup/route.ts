/**
 * POST /api/auth/signup
 * Create a student account. Validates against allowlist + join code.
 * Creates Supabase Auth user with pre-confirmed email.
 * No verification email is sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isSignupOpen,
  isAllowedDomain,
  isCommonPassword,
  isAccountLocked,
  logLoginEvent,
  generateSessionId,
} from "@/lib/auth";
import bcrypt from "bcryptjs";

const MAX_JOIN_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";

  // 1. Check sign-up window
  if (!isSignupOpen()) {
    return NextResponse.json(
      { error: "Sign-up is currently closed." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, email, registerNo, password, confirmPassword, joinCode, consent } = body;

  // 2. Validate inputs
  if (!name || !email || !registerNo || !password || !joinCode) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "You must agree to the terms." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (isCommonPassword(password)) {
    return NextResponse.json(
      { error: "This password is too common. Please choose a stronger one." },
      { status: 400 }
    );
  }
  if (!isAllowedDomain(email)) {
    return NextResponse.json(
      { error: "Please use your college email address." },
      { status: 400 }
    );
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanRegNo = registerNo.trim().toUpperCase();

  // 3. Check lockout
  const lockStatus = await isAccountLocked(cleanEmail);
  if (lockStatus.locked) {
    await logLoginEvent({
      eventType: "login_fail_locked",
      ip,
      userAgent: ua,
      details: { email: cleanEmail, reason: "join_code_lockout" },
    });
    return NextResponse.json(
      { error: "Account temporarily locked. Contact an organizer." },
      { status: 429 }
    );
  }

  // 4. Look up allowlist entry
  const admin = createSupabaseAdmin();
  const { data: student, error: lookupError } = await admin
    .from("students")
    .select("id, email, register_no, join_code_hash, join_attempts, status, auth_user_id")
    .eq("email", cleanEmail)
    .single();

  if (!student) {
    return NextResponse.json(
      { error: "Access Restricted: Contestants are added exclusively by Event Administrators. Please contact an organizer to receive your credentials." },
      { status: 403 }
    );
  }

  // 5. Check if account already created
  if (student.auth_user_id || student.status !== "registered") {
    return NextResponse.json(
      { error: "Your contestant account has already been provisioned by the Administrator. Please log in directly at /login or verify at /test-login." },
      { status: 409 }
    );
  }

  // 6. Check register number uniqueness
  const { data: existingReg } = await admin
    .from("students")
    .select("id")
    .eq("register_no", cleanRegNo)
    .neq("id", student.id)
    .maybeSingle();

  if (existingReg) {
    return NextResponse.json(
      { error: "This register number is already in use." },
      { status: 409 }
    );
  }

  // 7. Verify join code
  const joinCodeValid = await bcrypt.compare(joinCode.trim(), student.join_code_hash);
  if (!joinCodeValid) {
    const newAttempts = (student.join_attempts || 0) + 1;
    const updates: Record<string, unknown> = { join_attempts: newAttempts };

    if (newAttempts >= MAX_JOIN_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h lock
    }

    await admin.from("students").update(updates).eq("id", student.id);

    await logLoginEvent({
      studentId: student.id,
      eventType: "login_fail_password",
      ip,
      userAgent: ua,
      details: { reason: "wrong_join_code", attempt: newAttempts },
    });

    const remaining = MAX_JOIN_ATTEMPTS - newAttempts;
    return NextResponse.json(
      {
        error: remaining > 0
          ? `Invalid join code. ${remaining} attempts remaining.`
          : "Too many wrong attempts. Contact an organizer.",
      },
      { status: 401 }
    );
  }

  // 8. Create Supabase Auth user (pre-confirmed, no email sent)
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      name: name.trim(),
      register_no: cleanRegNo,
      role: "student",
    },
    app_metadata: {
      role: "student",
    },
  });

  if (authError || !authUser.user) {
    console.error("Auth user creation failed:", authError?.message);
    return NextResponse.json(
      { error: "Account creation failed. Please try again." },
      { status: 500 }
    );
  }

  // 9. Link auth user to student record
  const sessionId = generateSessionId();
  await admin
    .from("students")
    .update({
      name: name.trim(),
      register_no: cleanRegNo,
      auth_user_id: authUser.user.id,
      status: "account_created",
      consent_at: new Date().toISOString(),
      join_attempts: 0,
      locked_until: null,
      active_session_id: sessionId,
    })
    .eq("id", student.id);

  // 10. Sign in the user to get a session
  const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
    email: cleanEmail,
    password: password,
  });

  if (signInError || !signInData.session) {
    // Account created but sign-in failed — student can log in manually
    await logLoginEvent({
      studentId: student.id,
      authUserId: authUser.user.id,
      eventType: "signup_success",
      ip,
      userAgent: ua,
    });
    return NextResponse.json({
      success: true,
      message: "Account created. Please log in.",
      needsLogin: true,
    });
  }

  await logLoginEvent({
    studentId: student.id,
    authUserId: authUser.user.id,
    eventType: "signup_success",
    ip,
    userAgent: ua,
  });

  // Set session cookies
  const response = NextResponse.json({ success: true, redirect: "/lobby" });
  const maxAge = 60 * 60 * 24; // 24 hours
  response.cookies.set("sb-access-token", signInData.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
  });
  response.cookies.set("sb-refresh-token", signInData.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
  });
  response.cookies.set("quiz_session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
  });

  return response;
}
