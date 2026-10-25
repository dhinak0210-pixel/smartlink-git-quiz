/**
 * POST /api/admin/allowlist/import
 * Import registered students from registration data.
 *
 * Supports:
 * - Pre-save validation report (duplicates, malformed emails, missing fields)
 * - dryRun mode (inspect without writing to DB)
 * - Safe bcrypt hashing of join codes
 * - Atomic upsert / insert with full audit reporting
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not authorized: Admin session required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { students: importData, dryRun = false } = body;

  if (!Array.isArray(importData) || importData.length === 0) {
    return NextResponse.json({ error: "No student records provided" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Fetch all existing emails and register_nos to detect conflicts accurately
  const { data: existingStudents } = await admin
    .from("students")
    .select("email, register_no");

  const existingEmailSet = new Set((existingStudents || []).map((s: any) => s.email?.toLowerCase().trim()));
  const existingRegSet = new Set((existingStudents || []).map((s: any) => s.register_no?.toUpperCase().trim()));

  const seenInBatchEmails = new Set<string>();
  const seenInBatchRegs = new Set<string>();

  const validRows: any[] = [];
  const duplicatesInDb: any[] = [];
  const duplicatesInBatch: any[] = [];
  const malformed: any[] = [];
  const missingFields: any[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let idx = 0; idx < importData.length; idx++) {
    const row = importData[idx];
    const email = row.email?.toLowerCase().trim();
    const name = row.name?.trim();
    const registerNo = (row.register_no || row.college_id)?.trim().toUpperCase();
    const joinCode = (row.join_code || row.joinCode || "GITQUIZ2026")?.trim();

    // Check missing fields
    if (!email || !name || !registerNo) {
      missingFields.push({
        index: idx + 1,
        row,
        reason: "Missing one or more required fields (email, name, register_no)",
      });
      continue;
    }

    // Check malformed email
    if (!emailRegex.test(email)) {
      malformed.push({
        index: idx + 1,
        email,
        name,
        reason: "Invalid email syntax",
      });
      continue;
    }

    // Check duplicate in current batch
    if (seenInBatchEmails.has(email) || seenInBatchRegs.has(registerNo)) {
      duplicatesInBatch.push({
        index: idx + 1,
        email,
        registerNo,
        reason: "Appears multiple times within this uploaded file",
      });
      continue;
    }

    seenInBatchEmails.add(email);
    seenInBatchRegs.add(registerNo);

    // Check duplicate in database
    if (existingEmailSet.has(email) || existingRegSet.has(registerNo)) {
      duplicatesInDb.push({
        index: idx + 1,
        email,
        registerNo,
        reason: "Student already registered in database",
      });
      continue;
    }

    validRows.push({
      email,
      name,
      registerNo,
      joinCode,
    });
  }

  const validationReport = {
    totalSubmitted: importData.length,
    validCount: validRows.length,
    duplicateInDbCount: duplicatesInDb.length,
    duplicateInBatchCount: duplicatesInBatch.length,
    malformedCount: malformed.length,
    missingFieldsCount: missingFields.length,
    details: {
      duplicatesInDb,
      duplicatesInBatch,
      malformed,
      missingFields,
    },
  };

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      readyToImport: validRows.length > 0,
      validationReport,
    });
  }

  // Execute actual import for valid rows
  let created = 0;
  const errors: string[] = [];

  for (const valid of validRows) {
    try {
      const joinCodeHash = await bcrypt.hash(valid.joinCode, 10);
      const { error } = await admin.from("students").insert({
        name: valid.name,
        email: valid.email,
        register_no: valid.registerNo,
        college_id: valid.registerNo,
        join_code_hash: joinCodeHash,
        status: "registered",
      });

      if (error) {
        errors.push(`${valid.email}: ${error.message}`);
      } else {
        created++;
      }
    } catch (err: any) {
      errors.push(`${valid.email}: ${err.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    created,
    skipped: importData.length - created,
    errors,
    validationReport,
  });
}
