/**
 * POST /api/auth/reset-password
 * Reset password using email + join code. No email sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isCommonPassword, logLoginEvent } from "@/lib/auth";
import bcrypt from "bcryptjs";

const MAX_RESET_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";
  const { email, joinCode, newPassword, confirmPassword } = await req.json();

  if (!email || !joinCode || !newPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (isCommonPassword(newPassword)) {
    return NextResponse.json({ error: "This password is too common." }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const admin = createSupabaseAdmin();

  // 1. Find student
  const { data: student } = await admin
    .from("students")
    .select("id, auth_user_id, join_code_hash, join_attempts, locked_until")
    .eq("email", cleanEmail)
    .single();

  if (!student || !student.auth_user_id) {
    // Generic error — don't reveal whether email exists
    return NextResponse.json(
      { error: "Invalid email or join code." },
      { status: 401 }
    );
  }

  // 2. Check lockout
  if (student.locked_until && new Date(student.locked_until) > new Date()) {
    return NextResponse.json(
      { error: "Account locked. Contact an organizer." },
      { status: 429 }
    );
  }

  // 3. Verify join code
  const valid = await bcrypt.compare(joinCode.trim(), student.join_code_hash);
  if (!valid) {
    const newAttempts = (student.join_attempts || 0) + 1;
    const updates: Record<string, unknown> = { join_attempts: newAttempts };
    if (newAttempts >= MAX_RESET_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    await admin.from("students").update(updates).eq("id", student.id);

    await logLoginEvent({
      studentId: student.id,
      eventType: "login_fail_password",
      ip,
      userAgent: ua,
      details: { reason: "reset_wrong_code", attempt: newAttempts },
    });

    return NextResponse.json({ error: "Invalid email or join code." }, { status: 401 });
  }

  // 4. Update password via admin API
  const { error: updateError } = await admin.auth.admin.updateUserById(
    student.auth_user_id,
    { password: newPassword }
  );

  if (updateError) {
    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }

  // 5. Clear lockout and attempts
  await admin
    .from("students")
    .update({ join_attempts: 0, locked_until: null })
    .eq("id", student.id);

  await logLoginEvent({
    studentId: student.id,
    authUserId: student.auth_user_id,
    eventType: "password_reset",
    ip,
    userAgent: ua,
  });

  return NextResponse.json({
    success: true,
    message: "Password reset successful. Please log in.",
  });
}
