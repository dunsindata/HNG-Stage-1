import { z } from "zod";

/**
 * Validated environment access, public and server-only.
 *
 * Why not parse at module scope? `next build` also evaluates modules, so a
 * missing value would break the build instead of the request that needs it.
 * Parsing lazily keeps the build green while still failing fast (with a
 * readable message) the first time a Supabase client is created.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1, { message: "is required" })
    .regex(/^https?:\/\/[^\s]+$/, { message: "must be a valid http(s) URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(1, { message: "is required" }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Validated, server-only environment variables.
 *
 * Separate from the public schema on purpose: nothing about the Mailgun
 * credentials is ever read unless server code calls `getMailgunEnv()`, and that
 * only happens from `lib/mailgun.ts`, which runs on the server.
 */
const mailgunEnvSchema = z.object({
  MAILGUN_API_KEY: z
    .string()
    .trim()
    .min(1, { message: "is required" }),
  MAILGUN_DOMAIN: z
    .string()
    .trim()
    .min(1, { message: "is required" }),
});

export type MailgunEnv = z.infer<typeof mailgunEnvSchema>;

let cachedPublicEnv: PublicEnv | undefined;
let cachedMailgunEnv: MailgunEnv | undefined;

let warnedAboutRestUrl = false;

/**
 * Supabase's dashboard shows the REST endpoint
 * (`https://<ref>.supabase.co/rest/v1/`) right next to the project URL, so it is
 * easy to copy the wrong one. supabase-js appends `/rest/v1` itself, and a
 * pasted suffix produces a doubled path that every request rejects with
 * `PGRST125 Invalid path specified in request URL`. Normalising here turns that
 * paste into a harmless one-time warning instead of a broken app.
 */
function normaliseSupabaseUrl(rawUrl: string): string {
  const withoutTrailingSlash = rawUrl.trim().replace(/\/+$/, "");
  const baseUrl = withoutTrailingSlash.replace(/\/rest\/v1$/, "");

  if (baseUrl !== withoutTrailingSlash && !warnedAboutRestUrl) {
    warnedAboutRestUrl = true;
    console.warn(
      `[lib/env] NEXT_PUBLIC_SUPABASE_URL should be the project URL (${baseUrl}), ` +
        "not the /rest/v1 endpoint. Using the project URL.",
    );
  }

  return baseUrl;
}

/** Reads and validates the public Supabase env vars (memoised per process). */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"} ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        "Copy `.env.example` to `.env.local` and fill in the values.",
    );
  }

  cachedPublicEnv = {
    ...parsed.data,
    NEXT_PUBLIC_SUPABASE_URL: normaliseSupabaseUrl(parsed.data.NEXT_PUBLIC_SUPABASE_URL),
  };

  return cachedPublicEnv;
}

/**
 * Reads and validates the server-only Mailgun env vars (memoised per process).
 *
 * Like the public pair, this is parsed lazily: a missing credential should fail
 * the checkout that tries to send an email, not `next build`.
 */
export function getMailgunEnv(): MailgunEnv {
  if (cachedMailgunEnv) return cachedMailgunEnv;

  const parsed = mailgunEnvSchema.safeParse({
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"} ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid Mailgun configuration:\n${details}\n\n` +
        "Copy `.env.example` to `.env.local` and fill in MAILGUN_API_KEY and MAILGUN_DOMAIN.",
    );
  }

  cachedMailgunEnv = parsed.data;

  return cachedMailgunEnv;
}
