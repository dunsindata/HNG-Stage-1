/**
 * Database types for the Supabase `public` schema.
 *
 * These types mirror `supabase/migrations/00001_initial_schema.sql` exactly and
 * are written in the same shape `supabase gen types typescript` emits, so the
 * file can be regenerated without touching a single call site:
 *
 *   npx supabase gen types typescript --project-id <project-ref> > types/database.ts
 *
 * Why `type` aliases rather than `interface` for the row shapes? supabase-js
 * constrains every table's `Row` to `Record<string, unknown>`, and only type
 * aliases of object literals receive the implicit index signature that
 * requires — interfaces do not.
 *
 * Nullability is mirrored from the SQL: a `not null` column is required and
 * never null; every other column is `| null` on read and optional on
 * insert/update, because it falls back to its column default or to NULL.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
        // `users.id` references `auth.users(id)`, which PostgREST does not
        // expose, so there is no relationship to embed on this side. Traverse
        // from the other direction instead: `orders` embeds `users`.
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          price: number;
          stock: number;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          price: number;
          stock?: number;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          price?: number;
          stock?: number;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          total_amount: number;
          status: Database["public"]["Enums"]["order_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_amount: number;
          status?: Database["public"]["Enums"]["order_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_amount?: number;
          status?: Database["public"]["Enums"]["order_status"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          quantity: number;
          price_at_time: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          quantity: number;
          price_at_time: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          quantity?: number;
          price_at_time?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      // public.handle_new_user(): the auth.users -> public.users sync trigger.
      // Trigger functions return `trigger`, so PostgREST never exposes this as
      // an RPC; it is listed only to describe the schema.
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      order_status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/** A row of `public.users` — one per authenticated user. */
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

/** A row of `public.products` — the catalogue. */
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

/** A row of `public.orders` — one per checkout. */
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

/** A row of `public.order_items` — one line of an order. */
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
export type OrderItemUpdate = Database["public"]["Tables"]["order_items"]["Update"];

/** The `public.order_status` enum. */
export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Every status an order can be in, in the order it normally happens. */
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

/** Generic helpers in the same shape as `supabase gen types`. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
