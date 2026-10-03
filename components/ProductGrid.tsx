import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/types/database";

export interface ProductGridProps {
  products: Product[];
  /** Rendered instead of the grid when `products` is empty. */
  emptyMessage?: string;
}

/**
 * Responsive catalogue grid: 2 columns on mobile, 4 on large screens.
 *
 * A Server Component — the `Product` rows arrive as props and `ProductCard`
 * renders no client JS, so the whole grid is server-rendered HTML.
 */
export function ProductGrid({ products, emptyMessage = "No products yet." }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/10 py-16 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          {/* Only the first row is above the fold; the rest stay lazy. */}
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}
