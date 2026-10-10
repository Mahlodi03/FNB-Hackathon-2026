import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure Supabase env vars first (see .env.example)");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(allCookies) {
        try { allCookies.forEach(({name,value,options}) => cookieStore.set(name,value,options)); }
        catch { /* Server Components cannot set cookies; auth refresh must run in a mutable context. */ }
      }
    }
  });
}
