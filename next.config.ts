import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Static export: `next build` writes plain HTML/CSS/JS to `out/`, which the
// Worker serves as static assets (see wrangler.jsonc). Data that the owner
// changes later (products, settings, orders) comes from the Worker's /api,
// so adding a product never needs a rebuild.
//
// `next dev` cannot export, so there the site runs as a normal dev server and
// forwards /api and /images to `wrangler dev` (npm run worker:dev, port 8787).
const API_DEV = process.env.API_DEV_ORIGIN ?? "http://127.0.0.1:8787";

export default function config(phase: string): NextConfig {
  const base: NextConfig = {
    trailingSlash: true,
    images: { unoptimized: true },
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...base,
      async rewrites() {
        return [
          { source: "/api/:path*", destination: `${API_DEV}/api/:path*` },
          { source: "/images/:path*", destination: `${API_DEV}/images/:path*` },
        ];
      },
    };
  }
  return { ...base, output: "export" };
}
