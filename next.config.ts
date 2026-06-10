import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const isProd = process.env.NODE_ENV === "production";

// Origins the browser legitimately talks to: the Supabase project (REST + realtime)
// and Cloudflare R2 (direct presigned uploads). Wildcards keep this working across
// environments without hardcoding the project ref; the specific Supabase URL is
// appended when present.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const connectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.r2.cloudflarestorage.com",
  supabaseUrl,
  // Dev: allow Turbopack HMR websockets.
  ...(isProd ? [] : ["ws:", "http://localhost:*"]),
]
  .filter(Boolean)
  .join(" ");

// Content-Security-Policy. 'unsafe-inline' is required for Next's hydration
// bootstrap and for Tailwind/Recharts inline styles (we don't emit a nonce yet —
// see SECURITY_HARDENING_PLAN.md Phase 3 for the nonce upgrade). The high-value
// restrictions here are frame-ancestors/object-src/base-uri/form-action/connect-src.
// If anything breaks, switch the header key below to
// "Content-Security-Policy-Report-Only" while you tune it.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  `connect-src ${connectSrc}`,
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS only matters over HTTPS; browsers ignore it on http/localhost. Emit it
  // in production so the deployed app pins TLS.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version.
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  // @react-pdf/renderer is a heavy Node library; don't bundle it.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Cap server-action request bodies (uploads go direct to R2, so actions
    // only carry small JSON/form payloads).
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
