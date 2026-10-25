/**
 * One-click Backup & Export with SHA-256 Checksum
 *
 * GET /api/admin/backup
 * Downloads full export of all event records with cryptographic checksums.
 * Used before running any corrections, voids, or recomputations.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "backup");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const format = req.nextUrl.searchParams.get("format") || "json";

  // Gather all critical tables
  const [
    { data: settings },
    { data: students },
    { data: questions },
    { data: answers },
    { data: auditEntries },
    { data: voids },
    { data: flagDecisions },
    { data: winnerVerif },
  ] = await Promise.all([
    admin.from("event_settings").select("*").eq("event_id", eventId),
    admin.from("students").select("id, college_id, name, email, register_no, status, consent_at, created_at"),
    admin.from("questions").select("id, text, difficulty, topic, points_base, is_active"),
    admin.from("answers").select("*"),
    admin.from("audit_log").select("*").eq("event_id", eventId).order("created_at", { ascending: true }),
    admin.from("question_voids").select("*").eq("event_id", eventId),
    admin.from("flag_decisions").select("*").eq("event_id", eventId),
    admin.from("winner_verification").select("*").eq("event_id", eventId),
  ]);

  const exportPayload = {
    metadata: {
      eventId,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: adminUser.id,
        name: adminUser.displayName,
        role: adminUser.role,
      },
      schemaVersion: "2026.1",
    },
    tables: {
      event_settings: settings || [],
      students: students || [],
      questions: questions || [],
      answers: answers || [],
      question_voids: voids || [],
      flag_decisions: flagDecisions || [],
      winner_verification: winnerVerif || [],
      audit_log: auditEntries || [],
    },
  };

  const rawJson = JSON.stringify(exportPayload, null, 2);
  const checksum = crypto.createHash("sha256").update(rawJson).digest("hex");

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "export_backup",
    targetType: "event",
    targetId: eventId,
    after: { checksum, answersCount: answers?.length || 0, studentsCount: students?.length || 0 },
  });

  if (format === "csv") {
    // Generate CSV of answers as primary backup tabular format
    let csv = "student_id,question_id,option_id,is_correct,points,response_ms,created_at\n";
    for (const a of answers || []) {
      const optId = a.selected_option || a.option_id || "";
      const submittedAt = a.submitted_at || a.created_at || "";
      csv += `"${a.student_id}","${a.question_id}","${optId}",${a.is_correct},${a.points},${a.response_ms},"${submittedAt}"\n`;
    }
    const csvChecksum = crypto.createHash("sha256").update(csv).digest("hex");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smartlink_backup_${eventId.slice(0, 8)}_${Date.now()}.csv"`,
        "X-Checksum-SHA256": csvChecksum,
      },
    });
  }

  const finalResponse = {
    ...exportPayload,
    checksum: {
      algorithm: "SHA-256",
      hash: checksum,
    },
  };

  return new Response(JSON.stringify(finalResponse, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="smartlink_backup_${eventId.slice(0, 8)}_${Date.now()}.json"`,
      "X-Checksum-SHA256": checksum,
    },
  });
}
