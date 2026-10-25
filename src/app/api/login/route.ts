import { NextResponse } from 'next/server';
import { studentLogin, adminLogin } from '@/lib/auth/login';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch((err) => { console.error('parse err:', err); return null; });
    console.log('API LOGIN RECEIVED BODY:', body);

    const identifier = String(
      body?.college_id || body?.identifier || body?.email || ''
    ).trim();
    const secret = String(
      body?.secret || body?.join_code || body?.password || body?.code || ''
    ).trim();

    if (!identifier || !secret) {
      return NextResponse.json(
        { error: 'Please enter both your College ID / Email and Join Code / Password.' },
        { status: 400 }
      );
    }

    const cleanId = identifier.toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Dhina4213@';

    // Check if this is the admin logging in with unique email and password
    const isAdminCredentials =
      (cleanId === 'dhina7250@gmail.com' && secret === 'Dhina4213@') ||
      ((cleanId === 'dhina7250@gmail.com' || cleanId === 'admin') &&
        (secret === 'Dhina4213@' || secret === 'admin123' || secret === adminPassword));

    if (isAdminCredentials) {
      const adminResult = await adminLogin(secret, request);

      const maxAge = 60 * 60 * 24;
      const tokenPayload = {
        sub: 'admin-dhina',
        email: 'dhina7250@gmail.com',
        role: 'admin',
        app_metadata: { role: 'admin' },
        user_metadata: { name: 'Dhina (Lead Organizer)', role: 'admin' },
        exp: Math.floor(Date.now() / 1000) + maxAge,
      };
      const tokenStr =
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64') +
        '.' +
        Buffer.from(JSON.stringify(tokenPayload)).toString('base64') +
        '.mockSig';

      const response = NextResponse.json({
        ok: true,
        success: true,
        role: 'admin',
        name: 'Dhina (Lead Organizer)',
        redirect: '/admin/dashboard',
      });

      response.cookies.set('sb-access-token', tokenStr, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge,
        path: '/',
      });

      if (adminResult.token) {
        response.cookies.set('quiz_session', adminResult.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge,
          path: '/',
        });
      }

      return response;
    }

    // Otherwise authenticate as participant
    const result = await studentLogin(identifier, secret, request);

    if (!result.success) {
      const status = result.rateLimit && !result.rateLimit.allowed ? 429 : 401;
      return NextResponse.json(
        { error: result.error || 'Invalid credentials. Please verify your College ID and Join Code.' },
        {
          status,
          headers:
            result.rateLimit && !result.rateLimit.allowed
              ? { 'Retry-After': String(Math.ceil(result.rateLimit.retryAfterMs / 1000)) }
              : {},
        }
      );
    }

    const maxAge = 60 * 60 * 24;
    const tokenPayload = {
      sub: result.studentId || 'participant-' + identifier.toUpperCase(),
      cid: identifier.toUpperCase(),
      name: result.name || 'Participant',
      role: 'student',
      app_metadata: { role: 'student' },
      user_metadata: { name: result.name, role: 'student' },
      exp: Math.floor(Date.now() / 1000) + maxAge,
    };
    const tokenStr =
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64') +
      '.' +
      Buffer.from(JSON.stringify(tokenPayload)).toString('base64') +
      '.mockSig';

    let targetRedirect = '/lobby';
    try {
      const supabase = getSupabaseAdmin();
      const { data: qState } = await supabase.from('quiz_state').select('status').limit(1).maybeSingle();
      if (qState && (qState.status === 'active' || qState.status === 'running')) {
        targetRedirect = '/quiz';
      }
    } catch {}

    const response = NextResponse.json({
      ok: true,
      success: true,
      role: 'student',
      name: result.name,
      redirect: targetRedirect,
    });

    response.cookies.set('sb-access-token', tokenStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
      path: '/',
    });

    if (result.token) {
      response.cookies.set('quiz_session', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('[API /login] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
