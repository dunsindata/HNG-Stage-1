import type { Product } from "./database";

/**
 * The cart is client-side state until checkout — the initial schema has no
 * `carts` table, so `Cart` holds product ids and quantities in memory (or
 * localStorage) and checkout writes one `orders` row plus its `order_items`.
 */
export interface CartLine {
  product: Product;
  quantity: number;
  /** `product.price * quantity`, in the same units as `product.price`. */
  lineTotal: number;
}

/** The totals every cart view renders from. */
export interface CartTotals {
  /** Sum of `lineTotal` across all lines. */
  subtotal: number;
  /** Flat shipping fee, resolved at checkout. */
  shipping: number;
  /** `subtotal + shipping`. */
  total: number;
  /** Total number of units, i.e. the cart badge count. */
  itemCount: number;
}

/** A cart ready to render: its lines and its totals. */
export interface Cart {
  lines: CartLine[];
  totals: CartTotals;
}

/** Payload for adding to (or updating) a line in the cart. */
export interface CartItemInput {
  productId: Product["id"];
  /** Defaults to 1 when omitted. */
  quantity?: number;
}

/** Client-side cart state shape, useful for optimistic updates. */
export interface CartState {
  cart: Cart;
  isLoading: boolean;
  error: string | null;
}
