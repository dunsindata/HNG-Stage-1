import Link from "next/link";

import { ProductImage } from "@/components/ProductImage";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/database";

export interface ProductCardProps {
  product: Product;
  /**
   * Lifts the image to the top of the viewport budget for the first few cards
   * of a grid, so the LCP image is not lazy-loaded.
   */
  priority?: boolean;
}

/**
 * One tile in the catalogue grid: image, title and price, linking to the
 * product's detail page.
 *
 * A Server Component — it holds no state and receives a fully-formed `Product`
 * row as a prop, so it renders on the server with no client JS of its own.
 * The link wraps the whole tile; the accessible name comes from the title, and
 * the price sits inside the same anchor so it is part of the link text.
 */
export function ProductCard({ product, priority = false }: ProductCardProps) {
  const soldOut = product.stock <= 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/[.08] transition-colors hover:border-black/20 hover:bg-black/[.02] dark:border-white/[.145] dark:hover:border-white/30 dark:hover:bg-white/[.03]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <ProductImage
          product={product}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="transition-transform duration-300 group-hover:scale-105"
        />

        {soldOut && (
          <span className="absolute top-3 left-3 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {product.title}
        </h3>
        <p className="mt-auto pt-2 text-base font-semibold tabular-nums">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
