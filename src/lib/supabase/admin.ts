import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function wrapBuilder(builder: any, mockQuery: any): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (resolve: any, reject: any) => {
          return target.then((res: any) => {
            if (res.error && (res.error.code === "PGRST205" || res.error.message?.includes("schema cache"))) {
              return mockQuery.then(resolve, reject);
            }
            resolve(res);
          }).catch(() => mockQuery.then(resolve, reject));
        };
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return (...args: any[]) => {
          const nextBuilder = val.apply(target, args);
          const nextMock = typeof mockQuery?.[prop] === "function" ? mockQuery[prop](...args) : mockQuery;
          if (nextBuilder && typeof nextBuilder.then === "function") {
            return wrapBuilder(nextBuilder, nextMock);
          }
          return nextBuilder;
        };
      }
      return val;
    },
  });
}

/**
 * Admin client with service role key.
 * SERVER-SIDE ONLY — never import this in client components.
 * Bypasses RLS for account creation, user management, etc.
 * Resiliently falls back to seed store if tables are not yet migrated in Supabase.
 */
export function isRealSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key && !url.includes("placeholder") && !key.includes("placeholder"));
}

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key && !url.includes("placeholder") && !key.includes("placeholder")) {
    const realClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const mockClient = getSupabaseAdmin() as any;

    return new Proxy(realClient, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return (table: string) => {
            return wrapBuilder((target as any).from(table), mockClient.from(table));
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  return getSupabaseAdmin() as any;
}
