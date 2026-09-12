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
  // pdf-to-img/pdfjs-dist/pdf-parse are only ever require()'d from
  // scripts/pdf-extract.mjs, a standalone file invoked via child_process
  // (not imported anywhere in the app). Next's output file tracing has no
  // way to see that indirection, so it prunes those packages out of
  // production deployments that rely on the trace (e.g. Hostinger). Force
  // them - and the script itself - to be included for the route that spawns it.
  outputFileTracingIncludes: {
    '/api/resume/parse': [
      './scripts/pdf-extract.mjs',
      './node_modules/pdf-to-img/**/*',
      './node_modules/pdfjs-dist/**/*',
      './node_modules/pdf-parse/**/*',
    ],
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
