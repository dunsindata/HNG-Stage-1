-- =============================================================================
--  00001_initial_schema.sql  ·  initial e-commerce schema
-- =============================================================================
--
--  Apply it with the Supabase CLI:
--
--      supabase link --project-ref <project-ref>
--      supabase db push
--
--  ...or paste the whole file into the SQL editor of a fresh project. Each
--  migration is meant to run exactly once, so the DDL below is unguarded on
--  purpose: a re-run fails loudly instead of silently skipping a step.
--
--  Conventions
--    * Everything lives in the `public` schema.
--    * Primary keys are uuid, generated with gen_random_uuid() (built into
--      PostgreSQL 13+, so no extension is required on Supabase).
--    * Timestamps are timestamptz and default to now().
--    * Money is numeric(10, 2): exact decimal arithmetic, never a float.
--    * `public.users` mirrors `auth.users`, which Supabase owns and which the
--      API cannot read. Section 5 keeps the two in sync on sign-up.
-- =============================================================================


-- =============================================================================
--  1. Enum types
-- =============================================================================
create type public.order_status as enum (
  'pending',    -- created at checkout, payment not captured yet
  'paid',       -- payment captured
  'shipped',    -- handed to the carrier
  'delivered',  -- received by the customer
  'cancelled'   -- cancelled before fulfilment
);


-- =============================================================================
--  2. Tables
-- =============================================================================

-- users -----------------------------------------------------------------------
-- The application-side mirror of auth.users: exactly one row per authenticated
-- user. `id` is the auth user's id, so it needs no default — and gets none, so
-- a row here can never exist without its auth user.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),

  constraint users_email_not_blank check (length(btrim(email)) > 0)
);

-- products --------------------------------------------------------------------
-- The catalogue. `price` is per unit in the store's currency; `stock` is the
-- number of units on hand and may never go negative.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price numeric(10, 2) not null,
  stock integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),

  constraint products_title_not_blank check (length(btrim(title)) > 0),
  constraint products_price_non_negative check (price >= 0),
  constraint products_stock_non_negative check (stock >= 0)
);

-- orders ----------------------------------------------------------------------
-- One row per checkout. `total_amount` is denormalised on purpose: it records
-- what was agreed at purchase time and must not drift when prices change.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  total_amount numeric(10, 2) not null,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),

  constraint orders_total_amount_non_negative check (total_amount >= 0)
);

-- order_items -----------------------------------------------------------------
-- The lines of an order: deleting an order cascades to them.
-- `product_id` is nullable and uses ON DELETE SET NULL so that removing a
-- product from the catalogue cannot erase order history — `price_at_time` and
-- the order row already capture what the customer actually bought and paid.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity integer not null,
  price_at_time numeric(10, 2) not null,

  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_price_at_time_non_negative check (price_at_time >= 0)
);


-- =============================================================================
--  3. Indexes
-- =============================================================================
-- PostgreSQL indexes primary keys but never foreign keys, and every policy and
-- join below filters on exactly these columns.
create index orders_user_id_idx on public.orders (user_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index products_created_at_idx on public.products (created_at desc);


-- =============================================================================
--  4. Comments (surfaced in the Supabase table editor)
-- =============================================================================
comment on table public.users is 'Mirror of auth.users: one row per authenticated user.';
comment on table public.products is 'Product catalogue. Prices are per unit in the store currency.';
comment on table public.orders is 'One row per checkout, owned by the user who placed it.';
comment on table public.order_items is 'Order lines. price_at_time is the price actually charged.';

-- =============================================================================
--  5. Keep public.users in sync with auth.users
-- =============================================================================
-- SECURITY DEFINER lets the trigger insert the mirror row on behalf of a
-- brand-new sign-up, and the empty search_path stops a caller-controlled schema
-- from hijacking an unqualified name inside the function body.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The function exists only to be fired by that trigger, so it must not be
-- callable over the API (PostgREST would otherwise expose it as an RPC).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- `new.email` is never null for the email and Google providers this app
-- supports; adding a phone-only provider would mean making `users.email`
-- nullable first.


-- =============================================================================
--  6. Row Level Security
-- =============================================================================
-- RLS is fail-closed: once enabled, a table is invisible to `anon` and
-- `authenticated` unless a policy grants the operation. `service_role` and the
-- table owner bypass RLS, which is how admin code seeds products and how a
-- payment webhook flips an order to 'paid'.
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- users: read and update your own row, nothing else. There is deliberately no
-- INSERT policy — the SECURITY DEFINER trigger owns row creation, so a client
-- cannot forge a profile for somebody else.
create policy "Users can view their own row"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own row"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- products: the catalogue is public, anonymous visitors included. Writes are
-- intentionally left to the service role.
create policy "Products are readable by everyone"
  on public.products for select to anon, authenticated
  using (true);

-- orders: the owner, and nobody else, can read or create them. No UPDATE or
-- DELETE policy, so `status` stays server-controlled.
create policy "Users can view their own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own orders"
  on public.orders for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- order_items: ownership is inherited from the parent order, so both policies
-- walk up to public.orders and check who owns it.
create policy "Users can view items of their own orders"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1
      from public.orders as o
      where o.id = order_items.order_id
        and o.user_id = (select auth.uid())
    )
  );

create policy "Users can add items to their own orders"
  on public.order_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders as o
      where o.id = order_items.order_id
        and o.user_id = (select auth.uid())
    )
  );

-- Wrapping the call as `(select auth.uid())` lets PostgreSQL evaluate it once
-- per query (an InitPlan) instead of once per row, which on large tables is the
-- difference between an index scan and a sequential scan.


-- =============================================================================
--  7. Privileges
-- =============================================================================
-- Supabase already grants USAGE on `public` and privileges on new tables to
-- these roles; restating the intended surface keeps RLS the single gate and
-- makes the file self-documenting.
grant select on table public.products to anon, authenticated;
grant select, update on table public.users to authenticated;
grant select, insert on table public.orders to authenticated;
grant select, insert on table public.order_items to authenticated;
grant all on table public.users, public.products, public.orders, public.order_items to service_role;
