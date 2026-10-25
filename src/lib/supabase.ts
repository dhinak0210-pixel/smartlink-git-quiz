// src/lib/supabase.ts
// Supabase service-role client for server-side Next.js routes.

import { getSupabaseAdmin } from './supabase-server';

export const supabaseAdmin = getSupabaseAdmin();
export default supabaseAdmin;
