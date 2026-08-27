import type { NextConfig } from "next"

/**
 * R96.132 · Wave 2 Item #4 · Security hardening · headers globales.
 * - HSTS (https forced 1 year preload-ready)
 * - X-Content-Type-Options nosniff
 * - X-Frame-Options DENY (clickjacking)
 * - Referrer-Policy strict-origin-when-cross-origin
 * - Permissions-Policy (geolocation=self · camera/microphone deny)
 * - X-XSS-Protection 0 (deprecated · CSP es la defensa real)
 *
 * NOTA · CSP nonce-based completo requiere middleware más complejo ·
 * dejado out-of-scope · headers básicos cubren 80% del audit.
 */
const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ordaeyxvvvdqsznsecjx.supabase.co",
        pathname: "/storage/v1/object/public/agent-images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=()",
          },
          { key: "X-XSS-Protection", value: "0" },
        ],
      },
    ]
  },
}

export default config
