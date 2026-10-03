import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImage } from "@/components/ProductImage";
import { formatPrice, formatStock } from "@/lib/format";
import { getProductById, isProductId } from "@/lib/products";

export interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Per-product page, e.g. `/products/<uuid>`.
 *
 * The `Product` row is fetched on the server and handed to `AddToCartButton` as
 * a prop, so the button can be a Client Component without the page giving up
 * server rendering. `params` is a Promise in the App Router and must be awaited.
 */
export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;

  // A malformed id can never match a row, so skip the query entirely rather
  // than let Postgres reject it with a `uuid` parse error.
  if (!isProductId(id)) notFound();

  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All products
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          <ProductImage product={product} priority sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {product.title}
          </h1>

          <p className="mt-4 text-2xl font-semibold tabular-nums">{formatPrice(product.price)}</p>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {formatStock(product.stock)}
          </p>

          {product.description && (
            <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
              {product.description}
            </p>
          )}

          <div className="mt-8 max-w-sm">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Per-product metadata. Runs before the page and reuses the same lookup, so the
 * title tag always matches what the page renders.
 */
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!isProductId(id)) return { title: "Product not found" };

  const product = await getProductById(id);
  if (!product) return { title: "Product not found" };

  return {
    title: product.title,
    description: product.description ?? `Buy ${product.title} for ${formatPrice(product.price)}.`,
  };
}
