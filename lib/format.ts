/**
 * Display formatting for catalogue values.
 *
 * `products.price` is a Postgres `numeric`, which PostgREST returns as a JSON
 * number, so it reaches the UI as a plain `number`. The only thing left to
 * decide is how it reads, and every surface (card, detail page, cart totals)
 * must agree — hence one helper instead of scattered `toFixed(2)` calls.
 *
 * Amounts are held in the store currency; there is no multi-currency support,
 * so the currency is fixed rather than configurable.
 */
const CURRENCY = "USD";
const LOCALE = "en-US";

/** Formats a unit price or a cart total, e.g. `1234.5` -> `"$1,234.50"`. */
export function formatPrice(amount: number): string {
  // Postgres `numeric` can exceed the range a double represents exactly, and a
  // non-finite value would make `Intl.NumberFormat` render "NaN" on the page.
  if (!Number.isFinite(amount)) return formatPrice(0);

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
  }).format(amount);
}

/** Formats a stock count for display, e.g. `"3 left"` / `"In stock"`. */
export function formatStock(stock: number): string {
  if (stock <= 0) return "Out of stock";
  return stock < 10 ? `Only ${stock} left` : "In stock";
}
