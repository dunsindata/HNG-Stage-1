import type { Cart, CartLine, CartTotals } from "@/types/cart";
import type { Product } from "@/types/database";

/**
 * Pure cart arithmetic — no React, no `localStorage`.
 *
 * The state manager itself lives in `components/CartProvider.tsx`; everything
 * that decides *what* the cart contains lives here so it can be reasoned about
 * (and unit tested) without rendering anything. Every function is pure: same
 * input, same output, no mutation of the array it was handed.
 *
 * The cart is client-side only — the initial schema has no `carts` table, so
 * checkout will read these lines and write one `orders` row plus `order_items`.
 */

/** Flat shipping fee charged at checkout. */
export const FLAT_SHIPPING_FEE = 5;

/** Highest quantity a single line may hold. Caps runaway "+" clicks. */
export const MAX_LINE_QUANTITY = 99;

/**
 * Every cart mutation, as a discriminated union so each case narrows to the
 * payload it actually needs. `hydrate` replaces the whole cart at once (used
 * only when rehydrating from `localStorage`); the rest act on one product.
 */
export type CartAction =
  | { type: "add"; product: Product; quantity?: number }
  | { type: "setQuantity"; product: Product; quantity: number }
  | { type: "remove"; product: Product }
  | { type: "clear" }
  | { type: "hydrate"; cart: Cart };

/** An empty cart, ready to render. */
export function createEmptyCart(): Cart {
  return { lines: [], totals: calculateTotals([]) };
}

/** Derives every total from the lines. The only place totals are computed. */
export function calculateTotals(lines: CartLine[]): CartTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = lines.length === 0 ? 0 : FLAT_SHIPPING_FEE;

  return {
    subtotal,
    // An empty cart is never charged shipping — the total would read "$5.00"
    // on a cart the shopper is about to empty anyway.
    shipping,
    total: subtotal + shipping,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** Builds the line for `product`, rounding to cents to keep money exact. */
function createLine(product: Product, quantity: number): CartLine {
  return { product, quantity, lineTotal: Math.round(product.price * quantity * 100) / 100 };
}

/** Clamps a requested quantity to `1..MAX_LINE_QUANTITY`. */
function normaliseQuantity(quantity: number | undefined): number {
  if (quantity === undefined || !Number.isFinite(quantity)) return 1;

  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(quantity)));
}

/**
 * The cart reducer. `add` merges into an existing line for the same product
 * instead of appending a duplicate, which is what shoppers expect when they add
 * the same item twice.
 */
export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add": {
      const quantity = normaliseQuantity(action.quantity);
      const exists = cart.lines.some((line) => line.product.id === action.product.id);

      // The stored product is refreshed on every add so a price change in the
      // catalogue is reflected the next time the shopper taps "add".
      const lines = exists
        ? cart.lines.map((line) =>
            line.product.id === action.product.id
              ? createLine(action.product, line.quantity + quantity)
              : line,
          )
        : [...cart.lines, createLine(action.product, quantity)];

      return { lines, totals: calculateTotals(lines) };
    }

    case "setQuantity": {
      const quantity = normaliseQuantity(action.quantity);
      const lines = cart.lines.map((line) =>
        line.product.id === action.product.id ? createLine(line.product, quantity) : line,
      );

      return { lines, totals: calculateTotals(lines) };
    }

    case "remove": {
      const lines = cart.lines.filter((line) => line.product.id !== action.product.id);

      return { lines, totals: calculateTotals(lines) };
    }

    case "clear":
      return createEmptyCart();

    case "hydrate":
      return action.cart;

    default:
      return cart;
  }
}

/* -------------------------------------------------------------------------- */
/* localStorage persistence                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Key versioned so a change to `Product` (or to this file's serialised shape)
 * can't resurrect stale carts from users' browsers.
 */
export const CART_STORAGE_KEY = "storefront:cart:v1";

/**
 * Narrows unknown JSON to a `Product`. Every column the UI reads is checked,
 * because a partially-shaped product would surface as `undefined` mid-render.
 */
function toProduct(value: unknown): Product | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const isString = (key: string) => typeof candidate[key] === "string";
  const isNumber = (key: string) => typeof candidate[key] === "number";
  const isNullableString = (key: string) => candidate[key] === null || isString(key);

  const valid =
    isString("id") &&
    isString("title") &&
    isString("created_at") &&
    isNumber("price") &&
    isNumber("stock") &&
    isNullableString("description") &&
    isNullableString("image_url");

  return valid ? (value as Product) : null;
}

/**
 * Reads a persisted cart.
 *
 * The stored JSON is untrusted input — it is user-editable and survives across
 * app versions — so every line is validated against `Product` before it is
 * accepted, and anything unrecognised is dropped rather than crashing render.
 * Returns `null` when there is nothing usable to restore.
 */
export function parseStoredCart(raw: string | null): Cart | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted or hand-edited value: start clean rather than throw.
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || !("lines" in parsed)) return null;

  const rawLines: unknown = (parsed as { lines: unknown }).lines;
  if (!Array.isArray(rawLines)) return null;

  const lines: CartLine[] = [];

  for (const entry of rawLines) {
    if (typeof entry !== "object" || entry === null) continue;

    const product = toProduct((entry as { product?: unknown }).product);
    const quantity = (entry as { quantity?: unknown }).quantity;

    if (!product || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      continue;
    }

    lines.push(createLine(product, Math.min(MAX_LINE_QUANTITY, quantity)));
  }

  if (lines.length === 0) return null;

  return { lines, totals: calculateTotals(lines) };
}

/** Serialises a cart for storage. */
export function serialiseCart(cart: Cart): string {
  return JSON.stringify({ lines: cart.lines });
}

