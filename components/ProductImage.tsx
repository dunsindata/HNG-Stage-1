import Image from "next/image";
import { ImageOff } from "lucide-react";

import type { Product } from "@/types/database";

export interface ProductImageProps {
  product: Product;
  className?: string;
  /** `sizes` tells the optimiser which widths to generate; see the card grid. */
  sizes?: string;
  /** Set on above-the-fold images only, to stop lazy loading them. */
  priority?: boolean;
}

/**
 * A product's `image_url` rendered through the Next.js image optimiser.
 *
 * `image_url` is nullable and is free text in the database, so this component
 * is defensive in two ways: a product with no image renders a labelled
 * placeholder instead of a broken image, and a non-HTTPS or unparseable URL
 * falls back to a plain `<img>`. Without that fallback a single bad row would
 * make the optimiser throw and take the whole grid down with it.
 */
export function ProductImage({ product, className, sizes, priority }: ProductImageProps) {
  const src = product.image_url;
  const isOptimisable = src !== null && /^https:\/\//i.test(src);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 ${className ?? ""}`}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <span className="sr-only">No image available for {product.title}</span>
      </div>
    );
  }

  if (!isOptimisable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remotePatterns only
      // covers hosts we know about; an unexpected URL still has to render.
      <img
        src={src}
        alt={product.title}
        loading={priority ? "eager" : "lazy"}
        className={`object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={product.title}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
