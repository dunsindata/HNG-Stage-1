import { getMailgunEnv } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import type { CheckoutLineSummary } from "@/types/checkout";

/**
 * Mailgun transactional email, on the server only.
 *
 * Uses Mailgun's REST API over `fetch` with HTTP Basic auth (`api:<key>`) rather
 * than the `mailgun.js` SDK: it is one request, so the dependency — and its
 * `form-data` transitive — would not earn its place. The key and domain come
 * from `getMailgunEnv()`, which validates them lazily so a missing credential
 * fails the checkout that needs it rather than `next build`.
 */

/** Sender name shown in the inbox. The address is on the Mailgun domain. */
const SENDER_NAME = "Storefront";

/** Everything the order-confirmation email needs, already resolved server-side. */
export interface OrderConfirmationEmail {
  /** Recipient — the authenticated user's address from the Supabase session. */
  to: string;
  orderId: string;
  lines: CheckoutLineSummary[];
  subtotal: number;
  shipping: number;
  total: number;
}

/**
 * Sends the order-confirmation email.
 *
 * Throws on a non-2xx response so the caller decides what a failed send means;
 * `lib/actions/checkout.ts` treats it as best-effort and logs it, because the
 * order itself has already been committed.
 */
export async function sendOrderConfirmationEmail(email: OrderConfirmationEmail): Promise<void> {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN } = getMailgunEnv();

  // A `URLSearchParams` body sets `application/x-www-form-urlencoded`, which is
  // the payload Mailgun's `/messages` endpoint expects.
  const body = new URLSearchParams({
    from: `${SENDER_NAME} <noreply@${MAILGUN_DOMAIN}>`,
    to: email.to,
    subject: "Your Storefront order confirmation",
    text: buildOrderConfirmationText(email),
  });

  const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      // Mailgun expects the private API key as the password and `api` as the user.
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mailgun responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }
}

/**
 * The plain-text body: every purchased line and the money totals.
 *
 * `formatPrice` is reused so the figures in the email read exactly like the ones
 * in the cart, and the text is plain rather than HTML so it renders identically
 * in every mail client.
 */
function buildOrderConfirmationText(email: OrderConfirmationEmail): string {
  const items = email.lines
    .map((line) => `- ${line.quantity} x ${line.title} - ${formatPrice(line.lineTotal)}`)
    .join("\n");

  return [
    "Thanks for your order!",
    "",
    `Order reference: ${email.orderId}`,
    "",
    "Items",
    items,
    "",
    `Subtotal: ${formatPrice(email.subtotal)}`,
    `Shipping: ${formatPrice(email.shipping)}`,
    `Total: ${formatPrice(email.total)}`,
    "",
    "We'll email you again when it ships.",
    "",
    `- ${SENDER_NAME}`,
  ].join("\n");
}