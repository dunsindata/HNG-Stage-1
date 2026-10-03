import type { Metadata } from "next";

import { CartView } from "@/components/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your cart and check out.",
};

/**
 * Cart route.
 *
 * The cart is client-side state (`components/CartProvider.tsx`), so this page is
 * a Server Component that only renders the heading: `CartView` is the Client
 * Component that reads the cart and calls the checkout Server Action, which
 * writes one `orders` row plus its `order_items` and emails a receipt.
 */
export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartView />
    </main>
  );
}
