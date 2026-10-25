// src/app/api/admin/cheat-review/evidence/[studentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId } = params;
    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }

    const evidencePath = path.join(
      process.cwd(),
      'layer5-cheat',
      'report',
      'output',
      'evidence_packs',
      `student_${studentId}_evidence.md`
    );

    if (fs.existsSync(evidencePath)) {
      const markdown = fs.readFileSync(evidencePath, 'utf8');
      return NextResponse.json({
        student_id: studentId,
        evidence_markdown: markdown,
      });
    }

    return NextResponse.json({
      student_id: studentId,
      evidence_markdown: `# Student ${studentId}\n\nNo specialized evidence pack was compiled for this candidate (Tier: Clear or Watch).`,
    });
  } catch (error: any) {
    console.error('[API /admin/cheat-review/evidence] Error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
