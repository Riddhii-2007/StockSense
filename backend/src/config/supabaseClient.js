import { createClient } from '@supabase/supabase-js';
import config from './index.js';

/**
 * Whether Supabase credentials are present. Checked instead of asserted at
 * import time: the previous version threw on a missing SUPABASE_URL, which meant
 * merely importing this file took the whole server down even on the SQLite
 * driver, where Supabase is irrelevant.
 */
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);

let client = null;

/** Lazily create the client. Returns null when Supabase is not configured. */
export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      // The service role key is long-lived and server-side only. Without this,
      // the SDK tries to persist a session and refresh tokens it cannot use.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export default getSupabase;
