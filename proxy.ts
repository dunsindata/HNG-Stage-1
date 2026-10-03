import type { NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy — Next.js 16's renamed middleware convention.
 *
 * See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
 * "The `middleware` file convention is deprecated and has been renamed to
 * `proxy`", the exported function must be named `proxy`, and the runtime is
 * Node.js (not configurable).
 *
 * Its job here is session maintenance, not authorization: it refreshes the
 * Supabase auth cookies so Server Components always see a valid session. What a
 * user may actually read or write is enforced by Row Level Security in Postgres.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  return updateSession(request);
}

export const config = {
  /**
   * Run on every request except Next.js build output, the image optimiser and
   * static files — without these exclusions the proxy would also fire for CSS,
   * JS and images. The values must be literals so Next can read them at build
   * time; dynamically built patterns are ignored.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};