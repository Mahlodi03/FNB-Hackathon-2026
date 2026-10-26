import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/features/identity/config";
import { searchPublicStudents } from "@/features/identity/queries";
import { DirectoryQuerySchema } from "@/features/identity/schemas";
import { getSessionProfile } from "@/features/identity/queries";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured", code: "NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    if (!await getSessionProfile()) {
      return NextResponse.json({ error: "Sign in to search students", code: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return NextResponse.json({ error: "Unable to verify session", code: "SESSION_ERROR" }, { status: 503 });
  }
  const params = request.nextUrl.searchParams;
  const { q, page } = DirectoryQuerySchema.parse({ q: params.get("q") ?? "", page: params.get("page") ?? 1 });
  try {
    const result = await searchPublicStudents(q, page);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not search student profiles", code: "PROFILE_SEARCH_FAILED" }, { status: 500 });
  }
}
