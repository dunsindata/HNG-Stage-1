import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CartProvider } from "@/components/CartProvider";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Storefront",
    template: "%s | Storefront",
  },
  description: "An e-commerce storefront built with Next.js, Supabase and Mailgun.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the session happens on the server so the navbar renders the correct
  // state on first paint. It also makes every route dynamic, which is the price
  // of an auth-aware layout — `proxy.ts` has already refreshed the cookies, and
  // `getUser()` revalidates the JWT with Supabase Auth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Mounted above the navbar so the cart badge and any "add to cart"
            button in the tree below share one client-side cart. */}
        <CartProvider>
          <Navbar email={user?.email ?? null} />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
