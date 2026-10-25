/**
 * POST /api/webhooks/supabase-auth
 * Supabase Auth Webhook Handler
 *
 * Synchronizes events from Supabase Auth into the students table:
 * - user.deleted: Sets students.status = 'deactivated', clears active_session_id
 * - user.updated: Updates email or status changes
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_WEBHOOK_SECRET;
  const headerSecret = req.headers.get("x-supabase-webhook-secret");

  if (secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const { type, record } = payload;

  if (!record?.id) {
    return NextResponse.json({ received: true });
  }

  const admin = createSupabaseAdmin();

  if (type === "DELETE" || payload.event === "user.deleted") {
    await admin
      .from("students")
      .update({
        status: "deactivated",
        active_session_id: null,
      })
      .eq("auth_user_id", record.id);

    return NextResponse.json({ success: true, action: "student_deactivated" });
  }

  if (type === "UPDATE" || payload.event === "user.updated") {
    if (record.email) {
      await admin
        .from("students")
        .update({ email: record.email.toLowerCase() })
        .eq("auth_user_id", record.id);
    }
    return NextResponse.json({ success: true, action: "student_updated" });
  }

  return NextResponse.json({ received: true });
}
