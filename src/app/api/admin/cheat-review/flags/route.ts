// src/app/api/admin/cheat-review/flags/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tiersPath = path.join(process.cwd(), 'layer5-cheat', 'report', 'output', 'assigned_tiers.csv');
    const flags: any[] = [];

    if (fs.existsSync(tiersPath)) {
      const content = fs.readFileSync(tiersPath, 'utf8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',');

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        // Match CSV line respecting quotes
        const values: string[] = [];
        let insideQuote = false;
        let current = '';
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            values.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current);

        const record: Record<string, any> = {};
        headers.forEach((h, idx) => {
          record[h.trim()] = values[idx]?.replace(/^"|"$/g, '').trim();
        });

        flags.push({
          student_anon: parseInt(record.student_anon, 10),
          tier: record.tier,
          rank_in_tier: parseInt(record.rank_in_tier, 10),
          families_fired: record.families_fired ? record.families_fired.replace(/[\[\]']/g, '').split(';').map((s: string) => s.trim()).filter(Boolean) : [],
          family_count: parseInt(record.family_count, 10),
          evidence_summary: record.evidence_summary,
          trust_score: parseInt(record.trust_score, 10),
          is_podium: record.is_podium === 'True' || record.is_podium === 'true',
        });
      }
    }

    return NextResponse.json({
      total_students: flags.length,
      review_budget: 10,
      flags,
    });
  } catch (error: any) {
    console.error('[API /admin/cheat-review/flags] Error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
