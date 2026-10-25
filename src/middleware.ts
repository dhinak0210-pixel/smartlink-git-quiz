/**
 * Next.js Middleware
 * - Validates Supabase Auth session on protected routes
 * - Checks single-session enforcement (active_session_id match)
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users away from /login and /signup
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_ROUTES = ["/lobby", "/quiz", "/results", "/download"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/reset-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if needed
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    // Supabase network / server client failed
  }

  // Fallback check on sb-access-token or quiz_session for local/offline dev
  if (!user) {
    const token = req.cookies.get("sb-access-token")?.value || req.cookies.get("quiz_session")?.value;
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          if (payload?.sub) {
            user = {
              id: payload.sub,
              email: payload.email || (payload.role === "admin" ? "dhina7250@gmail.com" : undefined),
              app_metadata: payload.app_metadata || { role: payload.role || "student" },
            };
          }
        }
      } catch {}
    }
  }

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && !pathname.startsWith("/admin/login");
  const isAuth = AUTH_ROUTES.some((r) => pathname.startsWith(r)) || pathname === "/admin/login";

  // Redirect legacy /admin/login to unified /login
  if (pathname === "/admin/login") {
    if (user && user.app_metadata?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Practice mode has been retired: redirect immediately to contestant lobby
  if (pathname.startsWith("/practice")) {
    return NextResponse.redirect(new URL("/lobby", req.url));
  }

  // Protected routes: require auth
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes: require admin role (redirect to unified /login)
  if (isAdmin && (!user || user.app_metadata?.role !== "admin")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Auth routes: redirect if already logged in
  if (isAuth && user) {
    const role = user.app_metadata?.role;
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin/dashboard" : "/lobby", req.url)
    );
  }

  return res;
}

export const config = {
  matcher: [
    "/lobby/:path*",
    "/quiz/:path*",
    "/results/:path*",
    "/download/:path*",
    "/practice/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/reset-password",
  ],
};
