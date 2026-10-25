/**
 * GET /api/admin/students/status
 * Status board with search, filtering, and counts.
 * Help desk can access this but sees limited fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "student_lookup");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const search = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
  const statusFilter = req.nextUrl.searchParams.get("status") || "";
  const isHelpDesk = adminUser.role === "help_desk";

  let query = admin
    .from("students")
    .select(
      isHelpDesk
        ? "id, name, email, register_no, status, locked_until"
        : "id, name, email, register_no, status, locked_until, consent_at, created_at"
    )
    .order("name");

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Client-side search for sub-filters
  let filtered = students || [];
  if (search) {
    filtered = filtered.filter(
      (s: any) =>
        s.name?.toLowerCase().includes(search) ||
        s.email?.toLowerCase().includes(search) ||
        s.register_no?.toLowerCase().includes(search)
    );
  }

  // Counts
  const counts: Record<string, number> = {
    registered: 0,
    account_created: 0,
    logged_in: 0,
    playing: 0,
    finished: 0,
    deactivated: 0,
  };
  for (const s of students || []) {
    counts[s.status] = (counts[s.status] || 0) + 1;
  }

  return NextResponse.json({
    students: filtered,
    counts,
    total: filtered.length,
    isHelpDesk,
    role: adminUser.role,
  });
}
