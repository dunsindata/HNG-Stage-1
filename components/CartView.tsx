"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCart } from "@/components/CartProvider";
import { ProductImage } from "@/components/ProductImage";
import { checkout } from "@/lib/actions/checkout";
import { formatPrice } from "@/lib/format";
import { MAX_LINE_QUANTITY } from "@/lib/store/cart";
import type { CartLine, CartTotals } from "@/types/cart";
import type { CheckoutResult } from "@/types/checkout";

const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-600 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/10";

/**
 * The cart, as a Client Component.
 *
 * Reads the cart from `CartProvider` and calls the `checkout` Server Action.
 * Only ids and quantities are sent — the action re-prices every line and takes
 * the buyer's email from the Supabase session — and the cart is cleared only
 * after the server confirms the order, so a failed checkout keeps the items.
 *
 * `isHydrated` guards the first paint: the server render has no cart, so showing
 * the restored lines before hydration would mismatch the HTML.
 */
export function CartView() {
  const { cart, isHydrated, clearCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckoutResult | null>(null);

  function handleCheckout() {
    setResult(null);

    const request = cart.lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));

    startTransition(async () => {
      const outcome = await checkout(request);
      setResult(outcome);

      // Clear only on success, so a failure leaves the shopper's cart intact.
      if (outcome.ok) clearCart();
    });
  }

  if (!isHydrated) {
    return (
      <p
        role="status"
        className="mt-8 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your cart…
      </p>
    );
  }

  const { lines, totals } = cart;

  return (
    <div className="mt-8">
      {result && <CheckoutNotice result={result} />}

      {lines.length === 0 ? (
        <EmptyCart hasJustCheckedOut={result?.ok === true} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <ul className="flex flex-col gap-4">
            {lines.map((line) => (
              <li key={line.product.id}>
                <CartLineItem line={line} />
              </li>
            ))}
          </ul>

          <OrderSummary totals={totals} isPending={isPending} onCheckout={handleCheckout} />
        </div>
      )}
    </div>
  );
}

/** One line in the cart: image, title, per-unit price, quantity and remove. */
function CartLineItem({ line }: { line: CartLine }) {
  const { setQuantity, removeItem } = useCart();
  const { product, quantity } = line;

  return (
    <div className="flex gap-4 rounded-2xl border border-black/[.08] p-3 sm:p-4 dark:border-white/[.145]">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
        <ProductImage product={product} sizes="80px" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            href={`/products/${product.id}`}
            className="line-clamp-2 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {product.title}
          </Link>
          <p className="text-sm font-semibold tabular-nums">{formatPrice(line.lineTotal)}</p>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatPrice(product.price)} each</p>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuantity(product, quantity - 1)}
              disabled={quantity <= 1}
              aria-label={`Decrease quantity of ${product.title}`}
              className={ICON_BUTTON_CLASS}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-8 text-center text-sm tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(product, quantity + 1)}
              disabled={quantity >= MAX_LINE_QUANTITY}
              aria-label={`Increase quantity of ${product.title}`}
              className={ICON_BUTTON_CLASS}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => removeItem(product)}
            aria-label={`Remove ${product.title} from cart`}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/** Subtotal, shipping, total and the checkout button. */
function OrderSummary({
  totals,
  isPending,
  onCheckout,
}: {
  totals: CartTotals;
  isPending: boolean;
  onCheckout: () => void;
}) {
  return (
    <aside className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Order summary</h2>

      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-600 dark:text-zinc-400">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-600 dark:text-zinc-400">Shipping</dt>
          <dd className="tabular-nums">{formatPrice(totals.shipping)}</dd>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2 text-base font-semibold dark:border-white/15">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(totals.total)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onCheckout}
        disabled={isPending}
        className={`${PRIMARY_BUTTON_CLASS} mt-5`}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Placing order…
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Checkout
          </>
        )}
      </button>

      <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
        A confirmation email will be sent to your account address.
      </p>
    </aside>
  );
}

/** Success / failure banner shown above the cart after a checkout attempt. */
function CheckoutNotice({ result }: { result: CheckoutResult }) {
  if (result.ok) {
    return (
      <div
        role="status"
        className="mb-6 flex gap-3 rounded-2xl border border-green-600/30 bg-green-50 p-4 text-sm text-green-900 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-100"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Order placed — thank you!</p>
          <p className="mt-1">
            Your total was {formatPrice(result.total)}.{" "}
            {result.emailSent
              ? "A confirmation email is on its way."
              : "We saved your order, but the confirmation email could not be sent."}
          </p>
          <p className="mt-1 font-mono text-xs break-all opacity-80">Order {result.orderId}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mb-6 flex gap-3 rounded-2xl border border-red-600/30 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">We could not complete your checkout</p>
        <p className="mt-1">{result.error}</p>
      </div>
    </div>
  );
}

/** The empty state, which doubles as the confirmation after an order. */
function EmptyCart({ hasJustCheckedOut }: { hasJustCheckedOut: boolean }) {
  return (
    <div className="flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 px-6 py-14 text-center dark:border-white/20">
      <ShoppingCart className="h-6 w-6 text-zinc-400" aria-hidden="true" />
      <p className="font-medium">
        {hasJustCheckedOut ? "Your order is on its way" : "Your cart is empty"}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {hasJustCheckedOut ? (
          "Thanks for shopping with us — your confirmation email has the details."
        ) : (
          <>
            Browse the{" "}
            <Link
              href="/products"
              className="font-medium text-zinc-900 underline dark:text-zinc-50"
            >
              catalogue
            </Link>{" "}
            and add something you like.
          </>
        )}
      </p>
    </div>
  );
}