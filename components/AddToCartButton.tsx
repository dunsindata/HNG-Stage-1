"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/CartProvider";
import type { Product } from "@/types/database";

export interface AddToCartButtonProps {
  product: Product;
  /** Units to add per click. Defaults to 1. */
  quantity?: number;
  className?: string;
}

/**
 * "Add to cart" control, safe to drop into a server-rendered page.
 *
 * The `product` row is fetched on the server and handed down as a prop, so this
 * component never fetches anything itself — it only dispatches into the
 * client-side cart from `CartProvider`.
 *
 * Two details worth noting:
 * - Out-of-stock products are disabled, because the button would otherwise add
 *   units the `products` table says do not exist.
 * - The "Added" confirmation is cleared by a timeout that is cancelled on
 *   unmount. Without the cleanup, a shopper who navigates away within the
 *   confirmation window would set state on an unmounted component.
 */
export function AddToCartButton({ product, quantity = 1, className }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soldOut = product.stock <= 0;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleAdd() {
    addItem(product, quantity);
    setIsAdded(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsAdded(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={soldOut}
      aria-live="polite"
      className={
        className ??
        "inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      }
    >
      {isAdded ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Added to cart
        </>
      ) : soldOut ? (
        "Out of stock"
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Add to cart
        </>
      )}
    </button>
  );
}
