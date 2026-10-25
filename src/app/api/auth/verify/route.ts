import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent, isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  const student = await getAuthenticatedStudent(req);

  if (isAdmin) {
    return NextResponse.json({
      authenticated: true,
      role: 'admin',
      isParticipant: Boolean(student),
      student: student ? {
        id: student.id,
        name: student.name,
        college_id: student.college_id,
      } : {
        id: 'std-dhina-001',
        name: 'Dhina',
        college_id: 'DHINA7250',
      },
    });
  }

  if (student) {
    return NextResponse.json({
      authenticated: true,
      role: 'student',
      isParticipant: true,
      student: {
        id: student.id,
        name: student.name,
        college_id: student.college_id,
      },
    });
  }

  return NextResponse.json({
    authenticated: false,
    role: 'guest',
  });
}
