import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['pdfkit'],
  turbopack: {
    // Pin the project root explicitly. Without this, Turbopack's automatic
    // lockfile-based root detection can pick an unrelated ancestor directory
    // (e.g. a stray package-lock.json in the user's home folder), which
    // causes it to look for the `next` package in the wrong place and panic
    // with "Next.js package not found".
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // The Turbopack dev server repeatedly panics ("Next.js package not found")
    // while rebuilding the [...slug] app endpoint on every server-side Fast
    // Refresh cycle, which then forces the browser to reload in a loop.
    // Disabling server-side Fast Refresh stops the repeated rebuild/panic.
    turbopackServerFastRefresh: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
