"use client";
import { createBrowserClient } from "@supabase/ssr";
export function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure Supabase env vars first (see .env.example)");
  return createBrowserClient(url, key);
}
