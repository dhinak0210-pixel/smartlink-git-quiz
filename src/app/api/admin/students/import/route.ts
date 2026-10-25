// src/app/api/admin/students/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { logLoginEvent } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export interface CandidateContestant {
  name: string;
  email: string;
  registerNo: string;
  joinCode?: string;
  password?: string;
  status?: string;
  isValid?: boolean;
  validationError?: string;
}

function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

/**
 * Normalizes rows from XLSX/CSV into structured CandidateContestant objects.
 */
function normalizeRows(rows: Record<string, any>[]): CandidateContestant[] {
  return rows.map((r, idx) => {
    const keys = Object.keys(r);
    const findVal = (regex: RegExp) => {
      const k = keys.find((key) => regex.test(key.trim().toLowerCase()));
      return k ? String(r[k] || '').trim() : '';
    };

    const name = findVal(/name|student|participant|contestant/);
    const email = findVal(/email|mail/);
    const registerNo = findVal(/reg|roll|college|id|number/);
    const joinCode = findVal(/join|code|passcode/);
    const password = findVal(/pass|pwd/);

    const cleanEmail = email.toLowerCase();
    const cleanRegNo = (registerNo || `REG${1000 + idx}`).toUpperCase();
    const cleanName = name || `Contestant ${idx + 1}`;

    const isValid = Boolean(cleanEmail && cleanEmail.includes('@') && cleanName.length >= 2);
    const validationError = !cleanEmail || !cleanEmail.includes('@')
      ? 'Missing or invalid email'
      : cleanName.length < 2
      ? 'Name too short'
      : undefined;

    return {
      name: cleanName,
      email: cleanEmail,
      registerNo: cleanRegNo,
      joinCode: joinCode ? joinCode.toUpperCase() : undefined,
      password: password || undefined,
      isValid,
      validationError,
    };
  });
}

/**
 * Extract lines from PDF text and search for contestant patterns.
 */
function parseContestantsFromPdfText(text: string): CandidateContestant[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const contestants: CandidateContestant[] = [];
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const regNoRegex = /\b([A-Z0-9]{6,16})\b/i;

  let count = 1;
  for (const line of lines) {
    const emailMatch = line.match(emailRegex);
    if (emailMatch) {
      const email = emailMatch[1].toLowerCase();
      // Remove email from line to find name and regNo
      const remaining = line.replace(emailMatch[0], '').trim();
      const regMatch = remaining.match(regNoRegex);
      const registerNo = regMatch ? regMatch[1].toUpperCase() : `REG${202600 + count}`;
      let name = remaining.replace(regNoRegex, '').replace(/[,|\t;]/g, ' ').trim();

      // Clean leading numbers or S.No
      name = name.replace(/^\d+[\.\)]?\s*/, '').trim();
      if (!name) name = `Contestant ${count}`;

      contestants.push({
        name,
        email,
        registerNo,
        isValid: true,
      });
      count++;
    }
  }

  return contestants;
}

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';
  const admin = createSupabaseAdmin();

  try {
    const contentType = req.headers.get('content-type') || '';

    // ─── Direct JSON Parse or Commit Save ───
    if (contentType.includes('application/json')) {
      const body = await req.json();

      // Case 1: Save confirmed contestants in bulk
      if (body.save && Array.isArray(body.contestants)) {
        const toSave = body.contestants as CandidateContestant[];
        const results = [];
        let createdCount = 0;
        let skippedCount = 0;

        for (const item of toSave) {
          if (!item.email || !item.registerNo) {
            skippedCount++;
            continue;
          }

          const cleanEmail = item.email.trim().toLowerCase();
          const cleanRegNo = item.registerNo.trim().toUpperCase();
          const cleanName = item.name.trim();

          // Check if already in DB
          const { data: existing } = await admin
            .from('students')
            .select('id, email, register_no')
            .or(`email.eq.${cleanEmail},register_no.eq.${cleanRegNo}`)
            .maybeSingle();

          if (existing) {
            skippedCount++;
            results.push({
              ...item,
              id: existing.id,
              status: 'already_exists',
            });
            continue;
          }

          const codeToUse = (item.joinCode || generateJoinCode()).toUpperCase();
          const codeHash = await bcrypt.hash(codeToUse, 10);
          const pwdToUse = item.password || `Klu@${cleanRegNo.slice(-4) || '2026'}!`;

          let authUserId: string | null = null;
          try {
            const { data: newAuth } = await admin.auth.admin.createUser({
              email: cleanEmail,
              password: pwdToUse,
              email_confirm: true,
              user_metadata: { name: cleanName, register_no: cleanRegNo, role: 'student' },
            });
            if (newAuth?.user) {
              authUserId = newAuth.user.id;
            }
          } catch {
            // Soft fail if auth provision fails
          }

          const { data: newStudent } = await admin
            .from('students')
            .insert({
              name: cleanName,
              email: cleanEmail,
              register_no: cleanRegNo,
              college_id: cleanRegNo,
              join_code: codeToUse,
              join_code_hash: codeHash,
              auth_user_id: authUserId,
              status: 'account_created',
              is_active: true,
            })
            .select()
            .single();

          if (newStudent) {
            createdCount++;
            results.push({
              id: newStudent.id,
              name: cleanName,
              email: cleanEmail,
              register_no: cleanRegNo,
              join_code: codeToUse,
              password: pwdToUse,
              status: 'created',
            });
          }
        }

        await logLoginEvent({
          studentId: 'bulk-import',
          eventType: 'admin_bulk_import_contestants',
          ip,
          userAgent: ua,
          details: { createdCount, skippedCount, total: toSave.length },
        });

        return NextResponse.json({
          success: true,
          createdCount,
          skippedCount,
          contestants: results,
        });
      }

      // Case 2: Google Sheets URL import
      if (body.source === 'google-sheets-url' && body.url) {
        let exportUrl = body.url.trim();

        // Convert standard Google Spreadsheet URL to CSV export URL
        const match = exportUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          const sheetId = match[1];
          exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        }

        const fetchRes = await fetch(exportUrl, {
          headers: { 'User-Agent': 'SmartLink-Git-Quiz-Importer/1.0' },
        });

        if (!fetchRes.ok) {
          return NextResponse.json({
            error: `Failed to fetch Google Sheet (${fetchRes.status}). Please ensure the sheet sharing is set to "Anyone with the link can view".`,
          }, { status: 400 });
        }

        const csvText = await fetchRes.text();
        const wb = XLSX.read(Buffer.from(csvText), { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        const contestants = normalizeRows(rawRows);

        return NextResponse.json({
          success: true,
          count: contestants.length,
          contestants,
          source: 'google-sheets',
        });
      }

      // Case 3: Raw pasted text (TSV or CSV from Google Forms or clipboard)
      if (body.source === 'text' && body.text) {
        const wb = XLSX.read(Buffer.from(body.text), { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        let contestants = normalizeRows(rawRows);

        if (contestants.length === 0) {
          contestants = parseContestantsFromPdfText(body.text);
        }

        return NextResponse.json({
          success: true,
          count: contestants.length,
          contestants,
          source: 'raw-text',
        });
      }

      return NextResponse.json({ error: 'Invalid JSON import request' }, { status: 400 });
    }

    // ─── File Upload (multipart/form-data) ───
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = file.name.toLowerCase();

      let contestants: CandidateContestant[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        contestants = normalizeRows(rawRows);
      } else if (fileName.endsWith('.pdf')) {
        let pdfText = '';
        try {
          const pdfModule = require('pdf-parse');
          const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;
          if (typeof PDFParse === 'function') {
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            if (typeof parser.destroy === 'function') await parser.destroy();
            pdfText = result?.text || '';
          }
        } catch {
          pdfText = buffer.toString('utf-8');
        }
        contestants = parseContestantsFromPdfText(pdfText);
      } else {
        // Plain text / TSV
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        contestants = normalizeRows(rawRows);
      }

      return NextResponse.json({
        success: true,
        fileName: file.name,
        count: contestants.length,
        contestants,
      });
    }

    return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
  } catch (err: any) {
    console.error('[API /api/admin/students/import] Error:', err);
    return NextResponse.json({ error: err.message || 'Contestant import failed.' }, { status: 500 });
  }
}
