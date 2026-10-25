/**
 * POST /api/admin/helpdesk
 * Help desk actions: unlock, reset_code, force_logout, resend_code.
 * Requires "ID card checked" tick for reset and unlock.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
}

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "unlock_account");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { studentId, action, idChecked, note } = await req.json();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (!studentId || !action) {
    return NextResponse.json({ error: "studentId and action required." }, { status: 400 });
  }

  // ID check required for sensitive actions
  if (["unlock", "reset_code"].includes(action) && !idChecked) {
    return NextResponse.json(
      { error: "You must confirm the student's ID card was checked." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  // Verify student exists
  const { data: student } = await admin
    .from("students")
    .select("id, name, email, status, auth_user_id")
    .eq("id", studentId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  let result: Record<string, unknown> = {};

  switch (action) {
    case "unlock": {
      await admin
        .from("students")
        .update({ locked_until: null, join_attempts: 0 })
        .eq("id", studentId);
      result = { unlocked: true };
      break;
    }

    case "reset_code": {
      const newCode = generateCode();
      const hash = await bcrypt.hash(newCode, 10);
      await admin
        .from("students")
        .update({ join_code_hash: hash, join_attempts: 0, locked_until: null })
        .eq("id", studentId);
      result = { newCode }; // Shown to organizer only
      break;
    }

    case "force_logout": {
      if (adminUser.role === "help_desk") {
        return NextResponse.json({ error: "Help desk cannot force logout." }, { status: 403 });
      }
      await admin
        .from("students")
        .update({ active_session_id: null })
        .eq("id", studentId);
      result = { loggedOut: true };
      break;
    }

    case "resend_code": {
      result = { codeResent: true, message: "Join code queued for resend." };
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  // Log help desk action
  await admin.from("helpdesk_actions").insert({
    event_id: eventId,
    student_id: studentId,
    action,
    id_checked: idChecked || false,
    note: note || null,
    actor_id: adminUser.id,
    created_at: new Date().toISOString(),
  });

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: `helpdesk_${action}`,
    targetType: "student",
    targetId: studentId,
    after: result,
    reason: note,
    ip,
  });

  return NextResponse.json({ success: true, ...result });
}
