import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session for one request and returns the response that
 * carries any refreshed cookies.
 *
 * Next.js 16 renamed the `middleware.ts` *file convention* to `proxy.ts`, so
 * the entry point is `proxy.ts` in the repository root; it only calls this
 * function. The module keeps the "middleware" name it has in Supabase's own
 * documentation — nothing here depends on a Next.js convention.
 *
 * This runs on every matched request, so it stays deliberately small: it reads
 * the session and only writes cookies when the access token was refreshed.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // 1. Put the refreshed cookies on the request, so the Server
          //    Components rendering this very response already see the session.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          // 2. Rebuild the response from that request and attach the cookies,
          //    so the browser stores them as well.
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          // 3. Forward the cache headers Supabase sends with a cookie write
          //    (`private, no-store`, …) so a CDN or reverse proxy can never
          //    serve one user's session response to another.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // This call is what refreshes an expired token. It is deliberately the only
  // `await` in this function: a refresh that completes after the response has
  // been committed cannot be written back, and the next request would have to
  // refresh all over again.
  //
  // `getUser()` revalidates the JWT against Supabase Auth, whereas
  // `getSession()` merely decodes the cookie and trusts what it finds.
  await supabase.auth.getUser();

  return response;
}