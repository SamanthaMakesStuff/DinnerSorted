import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No image domains, no experimental flags needed — keep the deploy
  // footprint small and predictable for Vercel Hobby.
  poweredByHeader: false,
};

export default nextConfig;
