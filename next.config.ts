import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The Next.js image optimiser will only fetch from hosts allow-listed here,
    // so `products.image_url` needs its host added or the card renders nothing.
    // Unsplash covers the seeded catalogue; the Supabase storage bucket covers
    // uploads made through the dashboard.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
