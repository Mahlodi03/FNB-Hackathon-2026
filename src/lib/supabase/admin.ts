import "server-only";
import { createClient } from "@supabase/supabase-js";
/** Server only. Authenticate with serverSupabase().auth.getUser(), then authorize role and resource
 * ownership BEFORE using this privileged client. Never pass its key to the browser. */
export function serviceSupabase() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error("Missing server Supabase configuration");
 return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
