// src/app/api/auth/admin-login/route.ts
import { NextResponse } from 'next/server';
import { adminLogin } from '@/lib/auth/login';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const password = typeof body.password === 'string' ? body.password.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : 'dhina7250@gmail.com';

    if (!password) {
      return NextResponse.json(
        { error: 'Admin passkey or password is required.' },
        { status: 400 }
      );
    }

    const result = await adminLogin(password, request);

    if (!result.success) {
      const status = result.rateLimit && !result.rateLimit.allowed ? 429 : 401;
      return NextResponse.json(
        { error: result.error || 'Invalid admin credentials.' },
        {
          status,
          headers: result.rateLimit && !result.rateLimit.allowed
            ? { 'Retry-After': String(Math.ceil(result.rateLimit.retryAfterMs / 1000)) }
            : {},
        }
      );
    }

    const maxAge = 60 * 60 * 24;
    const response = NextResponse.json({
      ok: true,
      success: true,
      role: 'admin',
      token: result.token,
      redirect: '/admin/dashboard',
    });

    const tokenPayload = {
      sub: "admin-dhina",
      email: email || "dhina7250@gmail.com",
      role: "admin",
      app_metadata: { role: "admin" },
      user_metadata: { name: "Dhina", role: "admin" },
      exp: Math.floor(Date.now() / 1000) + maxAge,
    };
    const tokenStr =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64") +
      "." +
      Buffer.from(JSON.stringify(tokenPayload)).toString("base64") +
      ".mockSig";

    response.cookies.set("sb-access-token", tokenStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge,
      path: "/",
    });

    if (result.token) {
      response.cookies.set("quiz_session", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error('[API /auth/admin-login] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
