// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';
import { adminLogin } from '@/lib/auth/login';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.password !== 'string' || !body.password.trim()) {
      return NextResponse.json(
        { error: 'Missing password.' },
        { status: 400 }
      );
    }

    const result = await adminLogin(body.password, request);

    if (!result.success) {
      const status = result.rateLimit && !result.rateLimit.allowed ? 429 : 401;
      return NextResponse.json(
        { error: result.error },
        {
          status,
          headers: result.rateLimit && !result.rateLimit.allowed
            ? { 'Retry-After': String(Math.ceil(result.rateLimit.retryAfterMs / 1000)) }
            : {},
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API /admin/login] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
