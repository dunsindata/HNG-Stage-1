import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth callback — the `redirectTo` target of `signInWithOAuth`.
 *
 * Supabase sends the browser here with `?code=...` after the user consents. The
 * code is exchanged for a session, and `@supabase/ssr` writes that session into
 * cookies through the adapter in `lib/supabase/server.ts` (Route Handlers, unlike
 * Server Components, are allowed to set cookies).
 *
 * The PKCE code verifier created by `signInWithOAuth` is read from the request
 * cookies here, which is why this route must run on the same origin as the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveOrigin(request);

  // Google (or Supabase) can return an error instead of a code — for example
  // `access_denied` when the user closes the consent screen.
  const providerError = searchParams.get("error");
  if (providerError) {
    console.error(
      "[auth] provider returned an error:",
      providerError,
      searchParams.get("error_description") ?? "",
    );
    return NextResponse.redirect(new URL("/?authError=provider_error", origin));
  }

  const code = searchParams.get("code");
  if (!code) {
    console.error("[auth] callback reached without an authorization code");
    return NextResponse.redirect(new URL("/?authError=missing_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] code exchange failed:", error.message);
    return NextResponse.redirect(new URL("/?authError=exchange_failed", origin));
  }

  const next = searchParams.get("next") ?? "/";
  return NextResponse.redirect(new URL(isSafeRedirectPath(next) ? next : "/", origin));
}

/**
 * Behind a proxy (Vercel, Cloudflare) the request URL can point at the internal
 * host, so prefer the forwarded host when one is present. Locally there is no
 * such header and the request origin is already correct.
 */
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedHost) {
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

/**
 * `?next=` is attacker-controllable, so only same-origin absolute paths pass:
 * `//evil.example.com` and `https://evil.example.com` are both rejected.
 */
function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}