import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Server-side instrumentation is enabled by default in Next.js 16
  // The instrumentation.ts file will be automatically loaded
};

export default nextConfig;
