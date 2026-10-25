// src/app/api/admin/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const EXPORT_TABLES = [
  'students',
  'answers',
  'events',
  'flags',
  'reviews',
  'student_status',
] as const;

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const table = req.nextUrl.searchParams.get('table');

  if (table) {
    // Export single table
    if (!EXPORT_TABLES.includes(table as any)) {
      return NextResponse.json({ error: 'invalid_table' }, { status: 400 });
    }
    return await exportSingleTable(table);
  }

  // Export summary of all tables
  const summary: Record<string, number> = {};
  for (const t of EXPORT_TABLES) {
    const { count } = await supabaseAdmin
      .from(t)
      .select('*', { count: 'exact', head: true });
    summary[t] = count || 0;
  }

  return NextResponse.json({ tables: summary });
}

async function exportSingleTable(table: string) {
  const orderCol = table === 'student_status' ? 'updated_at' : 'created_at';
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .order(orderCol, { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ data: [], count: 0 });
  }

  // Convert to CSV
  const headers = Object.keys(data[0]);
  const csvLines = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape CSV
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ];

  const csv = csvLines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${table}_export.csv"`,
    },
  });
}
