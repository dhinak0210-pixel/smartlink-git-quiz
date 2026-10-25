/**
 * POST & GET /api/auth/logout
 * Sign out, invalidate server session, and thoroughly clear all session cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { logLoginEvent } from "@/lib/auth";
import { revokeSession } from "@/lib/auth/fingerprint";

export const dynamic = "force-dynamic";

const AUTH_COOKIE_NAMES = [
  "sb-access-token",
  "sb-refresh-token",
  "quiz_session",
  "quiz_session_id",
  "smartlink_session",
];

function clearAllCookies(response: NextResponse) {
  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.delete(name);
  }
}

async function performLogout(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";
  const token = req.cookies.get("sb-access-token")?.value || req.cookies.get("quiz_session")?.value;

  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload?.sub) {
          try {
            revokeSession(payload.sub);
          } catch {}

          try {
            const admin = createSupabaseAdmin();
            const { data: student } = await admin
              .from("students")
              .select("id")
              .eq("auth_user_id", payload.sub)
              .maybeSingle();

            if (student) {
              await admin.from("students").update({ active_session_id: null }).eq("id", student.id);
              await logLoginEvent({
                studentId: student.id,
                authUserId: payload.sub,
                eventType: "login_success",
                ip,
                userAgent: ua,
                details: { action: "logout" },
              });
            }
            await admin.auth.signOut(token);
          } catch {
            // Supabase client failure or offline dev environment — safe to ignore
          }
        }
      }
    } catch {
      // Token decode failed — proceed with cookie purge
    }
  }
}

export async function POST(req: NextRequest) {
  await performLogout(req);
  const response = NextResponse.json({ success: true, ok: true });
  clearAllCookies(response);
  return response;
}

export async function GET(req: NextRequest) {
  await performLogout(req);
  const response = NextResponse.redirect(new URL("/login", req.url));
  clearAllCookies(response);
  return response;
}

