import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Tests point both Liveblocks clients at `npx liveblocks dev`; its origin (and ws://) must be allowed too.
const liveblocksDev = process.env.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL;
const liveblocksDevHosts = liveblocksDev
  ? [new URL(liveblocksDev).origin, new URL(liveblocksDev).origin.replace(/^http/, "ws")]
  : [];

/**
 * Report-only for all of M1 (F15-D2): violations reach /api/csp-report and are triaged before a separate task
 * switches to enforcing. `img-src https://img.clerk.com` is verified (Clerk CSP guide, checked 2026-10-22); the
 * Clerk script/connect and Liveblocks hosts are resolved from preview reports (T-010), and the production Clerk
 * Frontend API host (`clerk.<prod-domain>`) is added once the production instance's domain exists. Scripts need
 * 'unsafe-inline' for Next's inline runtime (no nonces in M1); dev additionally needs 'unsafe-eval' for HMR.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.clerk.accounts.dev`,
  ["connect-src 'self' https://*.clerk.accounts.dev https://*.liveblocks.io wss://*.liveblocks.io", ...liveblocksDevHosts].join(" "),
  "img-src 'self' https://img.clerk.com data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "report-uri /api/csp-report",
].join("; ");

/** Security headers on every response (F15 FR-011, AC-019). */
const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // The dev-only route indicator defaults to bottom-left, where it covered F10's control bar (Zoom out).
  devIndicators: { position: "bottom-right" },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
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
