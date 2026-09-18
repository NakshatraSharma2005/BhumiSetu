import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16+.
  // MapLibre GL worker is served from /public/maplibre-gl-worker.mjs
  // and wired up via workerUrl in the client component — no bundler config needed.
  turbopack: {},
};

export default nextConfig;
