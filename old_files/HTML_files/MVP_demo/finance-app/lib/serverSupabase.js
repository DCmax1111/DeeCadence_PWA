import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

export function hasServerSupabaseConfig() {
  return Boolean(adminSupabase);
}

export function getServerSupabase() {
  if (!adminSupabase) {
    throw new Error('Supabase server environment is not configured');
  }
  return adminSupabase;
}

export function getServerAccessToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

export async function getAuthenticatedUserFromRequest(req) {
  const token = getServerAccessToken(req);
  if (!token) return null;

  const { data, error } = await getServerSupabase().auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
}
