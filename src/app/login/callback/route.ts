import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/features/identity/config";
import { safeRedirectPath } from "@/features/identity/schemas";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeRedirectPath(url.searchParams.get("next"), "/dashboard");
  const code = url.searchParams.get("code");
  const failure = new URL("/login?error=callback", url.origin);
  if (!isSupabaseConfigured() || !code) return NextResponse.redirect(failure);
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failure);
  return NextResponse.redirect(new URL(next, url.origin));
}
