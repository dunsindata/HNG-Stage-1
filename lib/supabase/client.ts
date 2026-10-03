import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components ("use client") and browser-only code.
 *
 * Safe to call on every render: `@supabase/ssr` keeps one underlying client
 * per browser tab, so this is cheap and returns a memoised instance.
 *
 * ```ts
 * "use client";
 * import { createClient } from "@/lib/supabase/client";
 *
 * const supabase = createClient();
 * await supabase.auth.signInWithOAuth({ provider: "google" });
 * ```
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
