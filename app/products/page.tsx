import type { Metadata } from "next";

import { ProductGrid } from "@/components/ProductGrid";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse every product in the storefront.",
};

/**
 * The full catalogue.
 *
 * Reads `public.products` with the server Supabase client and renders a
 * `ProductCard` per row. No session is needed - the migration makes products
 * publicly readable. Unpaginated for now; a `limit`/`offset` pair or a search
 * param is the natural next step once the catalogue outgrows one page.
 */
export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">
        {products.length === 0
          ? "Nothing in stock right now."
          : `${products.length} product${products.length === 1 ? "" : "s"}, newest first.`}
      </p>

      <div className="mt-10">
        <ProductGrid products={products} emptyMessage="Nothing in stock right now." />
      </div>
    </main>
  );
}
