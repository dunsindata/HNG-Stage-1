import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Always `await createClient()` inside a request scope so Next.js can attach
 * that request's cookies.
 *
 * ```ts
 * import { createClient } from "@/lib/supabase/server";
 *
 * const supabase = await createClient();
 * const { data: products } = await supabase.from("products").select("*");
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is expected when a page
          // renders while the session is refreshed elsewhere (middleware), so
          // the refresh is simply skipped here.
        }
      },
    },
  });
}
