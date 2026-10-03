import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProductGrid } from "@/components/ProductGrid";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Storefront",
  description: "Browse the catalogue and fill your cart.",
};

/** Tiles shown on the home page before linking through to the full catalogue. */
const FEATURED_LIMIT = 8;

/**
 * Home: a hero plus the newest slice of the catalogue.
 *
 * Reads `public.products` on the server through the server Supabase client. No
 * session is required - the migration makes the table readable by anyone, so
 * this renders identically for signed-in and signed-out visitors. The root
 * layout reads cookies, so the route is dynamic regardless.
 */
export default async function Home() {
  const products = await getProducts({ limit: FEATURED_LIMIT });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
        HNG Stage 1
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Everything in stock, one cart.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Products are read straight from Supabase on the server. Add something to
        the cart and the badge up top follows you across the site - the cart
        lives in your browser until checkout.
      </p>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Newest arrivals</h2>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6">
          <ProductGrid
            products={products}
            emptyMessage="The catalogue is empty. Add rows to public.products to see them here."
          />
        </div>
      </section>
    </main>
  );
}
