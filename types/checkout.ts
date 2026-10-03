import type { CartItemInput } from "./cart";

/**
 * Checkout shapes shared by the server action (`lib/actions/checkout.ts`) and
 * the client cart UI (`components/CartView.tsx`).
 *
 * The cart itself (`types/cart.ts`) is client-side state; these types describe
 * what crosses the network when that cart is turned into an order.
 */

/**
 * What the client sends: product ids and quantities only.
 *
 * Prices, stock and the buyer's email are deliberately absent — the server
 * action re-resolves all three, so a tampered request cannot change what is
 * charged or where the confirmation is sent.
 */
export type CheckoutRequest = CartItemInput[];

/** One line of a placed order, as summarised back to the client and emailed. */
export interface CheckoutLineSummary {
  title: string;
  quantity: number;
  /** `price_at_time * quantity`, rounded to cents. */
  lineTotal: number;
}

/**
 * What the checkout action returns.
 *
 * A discriminated union rather than a thrown error: a Server Action that throws
 * surfaces as an unhandled rejection in the caller, whereas `ok: false` lets the
 * cart show a message and keep the shopper's items intact.
 */
export type CheckoutResult =
  | { ok: true; orderId: string; total: number; emailSent: boolean }
  | { ok: false; error: string };