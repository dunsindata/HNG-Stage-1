/**
 * Single entry point for shared types.
 *
 *   import type { Product, Order, Cart } from "@/types";
 *
 * `types/database.ts` mirrors the SQL in `supabase/migrations` in the shape
 * `supabase gen types` produces; `types/cart.ts` holds the client-side cart
 * shapes and `types/checkout.ts` the shapes that cross the network at checkout.
 * All are re-exported here so call sites never need to know which file a type
 * lives in.
 */
export * from "./database";
export * from "./cart";
export * from "./checkout";
