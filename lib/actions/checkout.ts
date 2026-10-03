"use server";

import { z } from "zod";

import { sendOrderConfirmationEmail } from "@/lib/mailgun";
import { FLAT_SHIPPING_FEE, MAX_LINE_QUANTITY } from "@/lib/store/cart";
import { createClient } from "@/lib/supabase/server";
import type { CheckoutLineSummary, CheckoutRequest, CheckoutResult } from "@/types/checkout";

/**
 * Checkout, as a Server Action.
 *
 * The client sends *only* product ids and quantities — never prices or an email
 * address. Prices, stock and the buyer's identity are all resolved here from the
 * database and the Supabase session, so a tampered request cannot change what is
 * charged or who is emailed (see the Next.js "Server Actions" security guidance).
 *
 * It writes one `orders` row plus its `order_items` — the schema has no `carts`
 * table — and then emails a confirmation. Every failure path returns
 * `{ ok: false }` instead of throwing, so the cart UI can render a message and
 * keep the shopper's items.
 */

const checkoutRequestSchema = z
  .array(
    z.object({
      // `products.id` is a uuid, so a non-uuid id can never match a row; reject
      // it here rather than let Postgres fail the comparison with a 22P02 error.
      productId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    }),
  )
  .min(1, { message: "Your cart is empty." })
  .max(100, { message: "That is too many distinct items for one order." });

/** Rounds to cents so the stored total is exact `numeric(10,2)` money. */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export async function checkout(request: CheckoutRequest): Promise<CheckoutResult> {
  const parsed = checkoutRequestSchema.safeParse(request);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { ok: false, error: issue?.message ?? "Your cart looks invalid. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    console.error(
      "[checkout] rejected an unauthenticated request:",
      authError?.message ?? "no signed-in user",
    );
    return { ok: false, error: "Please sign in to complete your purchase." };
  }

  try {
    // Collapse duplicate ids so the same product cannot be charged twice in one
    // order, then read the authoritative prices and stock in a single query.
    const quantities = new Map<string, number>();
    for (const item of parsed.data) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, title, price, stock")
      .in("id", [...quantities.keys()]);

    if (productsError) {
      console.error("[checkout] could not load products:", productsError.message);
      return { ok: false, error: "We could not price your cart. Please try again." };
    }

    const productsById = new Map((products ?? []).map((product) => [product.id, product]));
    const lines: CheckoutLineSummary[] = [];
    const orderItems: { product_id: string; quantity: number; price_at_time: number }[] = [];

    for (const [productId, requestedQuantity] of quantities) {
      const product = productsById.get(productId);

      if (!product) {
        return { ok: false, error: "An item in your cart is no longer available." };
      }

      const quantity = Math.min(requestedQuantity, MAX_LINE_QUANTITY);
      if (quantity > product.stock) {
        return {
          ok: false,
          error:
            product.stock <= 0
              ? `"${product.title}" is out of stock.`
              : `Only ${product.stock} of "${product.title}" left in stock.`,
        };
      }

      const priceAtTime = roundCurrency(product.price);

      lines.push({
        title: product.title,
        quantity,
        lineTotal: roundCurrency(priceAtTime * quantity),
      });
      orderItems.push({ product_id: product.id, quantity, price_at_time: priceAtTime });
    }

    const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const shipping = FLAT_SHIPPING_FEE;
    const total = roundCurrency(subtotal + shipping);

    // `status` is left to its default of 'pending': payment capture and
    // fulfilment are server-controlled, and RLS grants no UPDATE policy.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ user_id: user.id, total_amount: total, status: "pending" })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[checkout] could not create the order:", orderError?.message);
      return { ok: false, error: "We could not place your order. Please try again." };
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError) {
      // The `orders` RLS policies grant select and insert only, so this
      // half-written order cannot be deleted from here — it is logged for
      // follow-up rather than hidden. The shopper is told it did not go through.
      console.error("[checkout] could not save order items:", itemsError.message);
      return { ok: false, error: "We could not place your order. Please try again." };
    }

    // The order is committed, so the email is best-effort: a Mailgun outage must
    // not turn a successful purchase into an error the shopper would retry.
    let emailSent = false;
    try {
      await sendOrderConfirmationEmail({
        to: user.email,
        orderId: order.id,
        lines,
        subtotal,
        shipping,
        total,
      });
      emailSent = true;
    } catch (error) {
      console.error("[checkout] order confirmation email failed:", error);
    }

    return { ok: true, orderId: order.id, total, emailSent };
  } catch (error) {
    console.error("[checkout] unexpected failure:", error);
    return { ok: false, error: "Something went wrong while placing your order. Please try again." };
  }
}