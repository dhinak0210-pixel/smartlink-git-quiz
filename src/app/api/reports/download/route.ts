// src/app/api/reports/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const student = await verifyStudentToken(req);
  if (!student) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const storagePath = `student-reports/${student.id}.pdf`;
    const { data: signedUrl, error } = await supabaseAdmin
      .storage
      .from('reports')
      .createSignedUrl(storagePath, 300);

    if (error || !signedUrl) {
      return NextResponse.json(
        { error: 'report_not_found', message: 'Your personalized report is not ready yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      download_url: signedUrl.signedUrl,
      student_id: student.id,
      expires_in: 300
    });
  } catch (err) {
    console.error('Report download error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
