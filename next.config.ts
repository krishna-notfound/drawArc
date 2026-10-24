import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // The dev-only route indicator defaults to bottom-left, where it covered F10's control bar (Zoom out).
  devIndicators: { position: "bottom-right" },
  // Clerk avatars (UserButton, F05 presence); next/image rejects every other remote host (code-standards rule 9).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com", pathname: "/**" }],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
