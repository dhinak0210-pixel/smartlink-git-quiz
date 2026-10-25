import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Supabase client for browser use.
 * Only uses the anon key — service role is never exposed.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
