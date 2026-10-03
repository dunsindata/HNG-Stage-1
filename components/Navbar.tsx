"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, LogOut, Menu, ShoppingCart, Store, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";

/** Primary site navigation. Add a link here and it appears on every page. */
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
] as const;

const LINK_CLASS =
  "text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50";
const PILL_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10";
const PRIMARY_CLASS =
  "inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export interface NavbarProps {
  /** Email of the signed-in user, resolved on the server in `app/layout.tsx`. */
  email?: string | null;
}

/**
 * Auth-aware navigation bar.
 *
 * A Client Component because the sign-in and sign-out buttons are interactive,
 * but the auth state is never fetched in the browser: `email` arrives as a prop
 * from the server render, so a signed-in visitor never sees a "Sign in" flash.
 * Signing out calls `router.refresh()` to re-render that server tree without the
 * session, which is why no `onAuthStateChange` subscription is needed here.
 *
 * The cart badge is the exception: it comes from `useCart()` rather than the
 * server, because the cart is client-side state that changes without a
 * navigation. `isHydrated` guards it — the server render has no cart, so
 * rendering the real count on the first paint would mismatch the HTML.
 */
export function Navbar({ email = null }: NavbarProps) {
  const router = useRouter();
  const { cart, isHydrated } = useCart();
  const [isPending, setIsPending] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const itemCount = cart.totals.itemCount;
  const badge = !isHydrated ? "0" : itemCount > 99 ? "99+" : String(itemCount);

  async function signInWithGoogle() {
    setIsPending(true);
    const supabase = createClient();

    // On success this navigates the browser to Google, so the pending state is
    // intentionally never cleared — the page is already on its way out.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      console.error("[auth] Google sign-in could not start:", error.message);
      setIsPending(false);
    }
  }

  async function signOut() {
    setIsPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) console.error("[auth] sign-out failed:", error.message);

    setIsMenuOpen(false);
    router.refresh();
    setIsPending(false);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-white/80 backdrop-blur-sm dark:border-white/15 dark:bg-black/60">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Store className="h-5 w-5" aria-hidden="true" />
          <span>Storefront</span>
        </Link>

        <ul className="hidden flex-1 items-center gap-6 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/cart"
            aria-label={`Cart, ${badge} item${badge === "1" ? "" : "s"}`}
            className={`${PILL_CLASS} relative`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="inline-flex min-w-5 justify-center rounded-full bg-zinc-900 px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {badge}
            </span>
          </Link>

          {email ? (
            <>
              <span
                className="hidden max-w-[12rem] truncate text-sm text-zinc-600 sm:inline-block dark:text-zinc-400"
                title={email}
              >
                {email}
              </span>
              <button
                type="button"
                onClick={signOut}
                disabled={isPending}
                aria-label="Sign out"
                className={PILL_CLASS}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isPending}
              aria-label="Sign in with Google"
              className={PRIMARY_CLASS}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Sign in with Google</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="navbar-mobile-menu"
            aria-label="Toggle navigation"
            className={`${PILL_CLASS} md:hidden`}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <ul
          id="navbar-mobile-menu"
          className="flex flex-col gap-2 border-t border-black/10 px-4 py-3 text-sm md:hidden dark:border-white/15"
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={LINK_CLASS}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}