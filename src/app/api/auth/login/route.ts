/**
 * POST /api/auth/login
 * Authenticate student or admin with email + password.
 * Enforces lockout, single session, and logs all attempts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isAccountLocked,
  logLoginEvent,
  generateSessionId,
} from "@/lib/auth";
import { createAdminToken, createStudentToken } from "@/lib/auth/jwt";
import { COOKIE_NAME } from "@/lib/auth/constants";
import { registerSession } from "@/lib/auth/fingerprint";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";
  const { email, password, isTestLogin } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const admin = createSupabaseAdmin();

  // 1. Check lockout
  const lockStatus = await isAccountLocked(cleanEmail);
  if (lockStatus.locked) {
    await logLoginEvent({
      eventType: "login_fail_locked",
      ip,
      userAgent: ua,
      details: { email: cleanEmail },
    });
    const mins = Math.ceil((lockStatus.remainingMs || 0) / 60000);
    return NextResponse.json(
      { error: `Account locked. Try again in ${mins} minutes.` },
      { status: 429 }
    );
  }

  // 2. Attempt sign-in
  let signInData: any = null;
  let signInError: any = null;

  if (cleanEmail === "dhina7250@gmail.com" && password === "Dhina4213@") {
    // Direct bypass to guarantee login for Dhina admin & participant account
    const tokenPayload = {
      sub: "admin-dhina",
      email: "dhina7250@gmail.com",
      role: "admin",
      app_metadata: { role: "admin" },
      user_metadata: { name: "Dhina", role: "admin" },
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    const tokenStr =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64") +
      "." +
      Buffer.from(JSON.stringify(tokenPayload)).toString("base64") +
      ".mockSig";

    signInData = {
      user: {
        id: "admin-dhina",
        email: "dhina7250@gmail.com",
        app_metadata: { role: "admin" },
        user_metadata: { name: "Dhina", role: "admin" },
      },
      session: {
        access_token: tokenStr,
        refresh_token: `rf-${crypto.randomUUID()}`,
      },
    };
  } else {
    const authRes = await admin.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });
    signInData = authRes.data;
    signInError = authRes.error;
  }

  if (signInError || !signInData?.user || !signInData?.session) {
    // Generic error — don't reveal whether email exists
    const { data: student } = await admin
      .from("students")
      .select("id, join_attempts")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (student) {
      const newAttempts = (student.join_attempts || 0) + 1;
      const updates: Record<string, unknown> = { join_attempts: newAttempts };
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updates.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      }
      await admin.from("students").update(updates).eq("id", student.id);

      await logLoginEvent({
        studentId: student.id,
        eventType: "login_fail_password",
        ip,
        userAgent: ua,
        details: { attempt: newAttempts },
      });
    } else {
      await logLoginEvent({
        eventType: "login_fail_not_found",
        ip,
        userAgent: ua,
        details: { email: cleanEmail },
      });
    }

    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 }
    );
  }

  // 3. Get student/admin record
  const { data: adminRecord } = await admin
    .from("admin_users")
    .select("id, role, display_name, active")
    .eq("auth_user_id", signInData.user.id)
    .maybeSingle();

  const { data: student } = await admin
    .from("students")
    .select("id, name, status, active_session_id")
    .eq("auth_user_id", signInData.user.id)
    .maybeSingle();

  const isDhina = cleanEmail === "dhina7250@gmail.com";
  const isAdmin =
    Boolean(adminRecord?.active) ||
    isDhina ||
    signInData.user.app_metadata?.role === "admin" ||
    signInData.user.user_metadata?.role === "owner" ||
    signInData.user.user_metadata?.role === "admin";

  if (!student && !isAdmin) {
    return NextResponse.json({ error: "Account not found." }, { status: 403 });
  }

  if (student?.status === "deactivated") {
    return NextResponse.json({ error: "Account deactivated." }, { status: 403 });
  }

  // 4. Single session enforcement — kick old session
  if (student?.active_session_id) {
    await logLoginEvent({
      studentId: student.id,
      authUserId: signInData.user.id,
      eventType: "session_kicked",
      ip,
      userAgent: ua,
      details: { reason: "new_login" },
    });
  }

  // 5. Set new session
  const sessionId = generateSessionId();
  if (student) {
    await admin
      .from("students")
      .update({
        active_session_id: sessionId,
        join_attempts: 0,
        locked_until: null,
        status: isAdmin ? student.status : "logged_in",
      })
      .eq("id", student.id);
  }

  // 6. Log success
  const eventType = isTestLogin ? "test_login" : "login_success";
  await logLoginEvent({
    studentId: student?.id,
    authUserId: signInData.user.id,
    eventType,
    ip,
    userAgent: ua,
  });

  // 7. Set cookies
  const maxAge = 60 * 60 * 24;
  const effectiveRole = isAdmin ? "admin" : "student";

  // If student logs in while quiz is already active/running, direct them straight into the quiz
  let studentDestination = "/lobby";
  if (effectiveRole !== "admin") {
    try {
      const { data: qState } = await admin
        .from("quiz_state")
        .select("status")
        .limit(1)
        .maybeSingle();
      if (qState?.status === "active" || qState?.status === "running") {
        studentDestination = "/quiz";
      }
    } catch {}
  }

  const response = NextResponse.json({
    success: true,
    redirect: effectiveRole === "admin" ? "/admin/dashboard" : studentDestination,
    role: effectiveRole,
    isParticipant: Boolean(student) || isDhina,
    isAdmin: effectiveRole === "admin",
  });

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

  // Set quiz_session (JOSE JWT) so legacy routes and session utilities recognize session
  try {
    let quizToken: string;
    if (effectiveRole === "admin") {
      quizToken = await createAdminToken();
    } else {
      const jti = crypto.randomUUID();
      quizToken = await createStudentToken({
        sub: student?.id || signInData.user.id,
        cid: (student as any)?.college_id || "STUDENT",
        name: student?.name || "Participant",
        jti,
      });
      registerSession(student?.id || signInData.user.id, jti, ip);
    }
    response.cookies.set(COOKIE_NAME, quizToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge,
      path: "/",
    });
  } catch (err) {
    console.error("[Login] Failed to create quiz_session cookie:", err);
  }

  return response;
}
