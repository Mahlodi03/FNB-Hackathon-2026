/**
 * Keep Supabase's server-rendered session cookies synchronized in Next.js 16.
 *
 * Server Components cannot reliably write refreshed auth cookies. The proxy
 * runs before rendering and propagates rotated session cookies to both the
 * in-flight request and the browser response.
 *
 * Authorization still happens inside the existing protected pages and APIs.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Preserve the existing configuration/setup experience when env is absent.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
        setAll(cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]) {
        // Make a refreshed session immediately visible to Server Components.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        // Persist the same session to the browser for the next navigation.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  // Validate or refresh the session without trusting an unverified user object.
  // Protected pages and APIs keep their existing role/authorization checks.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Do not run the auth proxy for static files, wasm models or Next assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|wasm|woff|woff2|ttf)$).*)",
  ],
};
