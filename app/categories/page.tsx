import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories",
  description: "Shop the storefront by category.",
};

/**
 * Placeholder category listing.
 *
 * The initial schema has no categories table, so this route is a stub: grouping
 * the catalogue (a `categories` table, or a tag column on `products`) is a
 * prerequisite for filling it in.
 */
export default function CategoriesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">
        Category browsing needs a{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
          categories
        </code>{" "}
        table (or a tag column on{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
          products
        </code>
        ); neither exists in the initial migration yet.
      </p>
    </main>
  );
}
