import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

/**
 * Catalogue reads, on the server only.
 *
 * Every query goes through here rather than being inlined in a page, so the
 * selected columns, the ordering and the error handling are defined once. All
 * of it uses the server client, which carries the visitor's cookies; the
 * migration grants anonymous `select` on `products`, so no session is required
 * and the response is safe to cache.
 *
 * A failed read is logged and returned as an empty result: a Supabase outage
 * should render an empty catalogue with the error logged, not a 500 that hides
 * the rest of the page.
 */

/** Columns the UI reads. Select them explicitly rather than with `*`. */
const PRODUCT_COLUMNS = "id, title, description, price, stock, image_url, created_at" as const;

/** Newest first — matches the order a shopper expects on a storefront. */
const PRODUCT_ORDER = { column: "created_at", ascending: false } as const;

/**
 * The catalogue, newest first.
 *
 * `limit` is applied per row rather than after the fetch so the home page does
 * not pull the entire table to show a handful of tiles.
 */
export async function getProducts(options: { limit?: number } = {}): Promise<Product[]> {
  const supabase = await createClient();
  const { limit } = options;

  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .order(PRODUCT_ORDER.column, { ascending: PRODUCT_ORDER.ascending });

  if (typeof limit === "number" && limit > 0) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[lib/products] could not load the catalogue:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * A single product by its UUID, or `null` if there is no such row.
 *
 * Returns `null` rather than throwing so the detail page can call
 * `notFound()` and render the 404 boundary. A malformed id is not an error
 * worth surfacing either — it is simply a URL that matches no product.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    // A UUID column compared against a non-UUID string is a Postgres error
    // (22P02), not an empty result, so the id is checked before querying.
    .maybeSingle();

  if (error) {
    console.error(`[lib/products] could not load product ${id}:`, error.message);
    return null;
  }

  return data;
}

/**
 * Whether `id` could be a `products.id` at all.
 *
 * `products.id` is a `uuid` with a generated default, so a valid route param is
 * always a well-formed UUID. Checking the shape first turns `/products/banana`
 * into a 404 instead of a database error.
 */
export function isProductId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
