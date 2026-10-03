# Storefront — HNG Stage 1

A full-stack e-commerce web application.

**Stack:** [Next.js 16](https://nextjs.org) (App Router, TypeScript, Turbopack) ·
[Tailwind CSS v4](https://tailwindcss.com) · [Supabase](https://supabase.com)
(Postgres + Auth, Google OAuth) · [Mailgun](https://www.mailgun.com) (transactional email) ·
[Zod](https://zod.dev) (validation) · [lucide-react](https://lucide.dev) (icons).

## Getting started

```bash
npm install                 # install dependencies
Copy-Item .env.example .env.local   # then fill in the real values
npm run dev                 # http://localhost:3000
```

`npm run dev` uses Turbopack (the Next.js 16 default) with Fast Refresh.

## Environment variables

Every variable is declared in `.env.example`; real values belong in
`.env.local`, which is git-ignored.

| Variable | Scope | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase → Project Settings → API (RLS-protected) |
| `GOOGLE_CLIENT_ID` | server only | Google Cloud Console → Credentials → OAuth client |
| `GOOGLE_CLIENT_SECRET` | server only | Google Cloud Console → Credentials → OAuth client |
| `MAILGUN_API_KEY` | server only | Mailgun → Sending → Domain settings → API keys |
| `MAILGUN_DOMAIN` | server only | Mailgun → Sending → Domains |

Only `NEXT_PUBLIC_*` values reach the browser; everything else must stay on the
server (Route Handlers / Server Actions). The public pair is validated lazily by
`lib/env.ts` with Zod, so a missing value fails the first Supabase call with a
readable message instead of breaking `next build`.

## Project structure

```
app/                    App Router routes (layout, pages, auth/callback handler)
components/Navbar.tsx   Auth-aware navigation bar (Client Component)
components/CartView.tsx Interactive cart: lines, totals and the Checkout button
lib/actions/checkout.ts Checkout Server Action: writes the order and emails a receipt
lib/mailgun.ts          Sends the order-confirmation email over Mailgun's REST API
lib/env.ts              Zod-validated environment access (public + Mailgun)
lib/supabase/client.ts  Supabase client for Client Components
lib/supabase/server.ts  Supabase client for Server Components / Actions
lib/supabase/middleware.ts  Session-refresh helper called by proxy.ts
proxy.ts                Next.js 16 proxy entry point (the old middleware.ts)
types/database.ts       Schema types mirroring supabase/migrations (users, products,
                        orders, order_items) plus the supabase-js Database generic
types/cart.ts           Client-side cart shapes (Cart, CartLine, CartTotals, …)
types/checkout.ts       Checkout request/result shapes shared by the action and UI
types/index.ts          Single import point: `import type { Product, Order, Cart } from '@/types'`
supabase/migrations/    SQL migrations, applied with the Supabase CLI
legacy-todo-app/        The previous Stage project, kept for reference
```

Imports use the `@/*` alias, which maps to the repository root:
`import { Navbar } from '@/components/Navbar'`.

## Database

The schema lives in `supabase/migrations/00001_initial_schema.sql`. Apply it with
the Supabase CLI — running `supabase init` once first, if `supabase/config.toml`
does not exist yet — or paste it into the SQL editor of a fresh project:

```bash
supabase init                          # once; creates supabase/config.toml
supabase link --project-ref <project-ref>
supabase db push
```

| Table | Purpose | Row Level Security |
| --- | --- | --- |
| `users` | Mirror of `auth.users`, kept in sync by an insert trigger | read/update your own row only |
| `products` | Catalogue; `price` is `numeric(10,2)` and `stock >= 0` | readable by everyone; writes are service-role only |
| `orders` | One row per checkout; `user_id` cascades from `users` | the owner can read and insert only |
| `order_items` | Order lines; deleting an order cascades to them | the owner (via the parent order) can read and insert only |

RLS is enabled on all four tables, every foreign key is indexed, and CHECK
constraints guard the money and stock columns. `types/database.ts` mirrors this
schema by hand in the shape `supabase gen types typescript` emits, so it can be
regenerated at any time without touching a call site:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```

## Authentication

Google sign-in runs through Supabase Auth:

1. `components/Navbar.tsx` calls `signInWithOAuth` with `provider: "google"` and
   `redirectTo` set to the current origin plus `/auth/callback`.
2. Supabase sends the browser to Google, which returns it to Supabase's own
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase redirects to `app/auth/callback/route.ts` with `?code=…`. That route
   exchanges the code for a session (`exchangeCodeForSession`), and
   `lib/supabase/server.ts` writes the session cookies (a Route Handler, unlike a
   Server Component, is allowed to).
4. `proxy.ts` — Next.js 16's renamed `middleware.ts` — refreshes those cookies on
   every request via `lib/supabase/middleware.ts`, and `app/layout.tsx` reads the
   user on the server so the navbar renders the correct state on first paint.

In the Supabase dashboard, **Authentication → URL Configuration** must list:

| Setting | Value |
| --- | --- |
| Site URL | `http://localhost:3000` locally, your production URL otherwise |
| Redirect URLs | `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` |

Authorization is deliberately *not* enforced in the proxy: what a signed-in user
may read or write is decided by the Row Level Security policies in
`supabase/migrations/00001_initial_schema.sql`.

## Checkout

`components/CartView.tsx` renders the client-side cart with a **Checkout**
button. Clicking it calls the `checkout` Server Action in
`lib/actions/checkout.ts`, which:

1. Resolves the buyer from the Supabase session and reads the email there — the
   client never sends an address.
2. Re-prices the cart from `products` (only ids and quantities cross the wire),
   so a tampered request cannot change the amount charged.
3. Inserts one `orders` row plus its `order_items`, then emails a confirmation
   through `lib/mailgun.ts` from `Storefront <noreply@$MAILGUN_DOMAIN>`, listing
   the purchased items and the total.
4. Returns a discriminated result. The cart is cleared only on `{ ok: true }`, so
   a failure keeps the shopper's items and shows the error inline. A Mailgun
   outage is logged and reported, but does not fail an order already committed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |

## Notes

* `legacy-todo-app/` holds the earlier Express + SQLite to-do app (API, two
  UIs, its Vercel config and its own `package.json`). It is intentionally
  excluded from the Next.js build and is not part of this application.
* There is deliberately no `carts` table: the cart is client-side state
  (`types/cart.ts`) until checkout, which writes one `orders` row plus its
  `order_items`.
