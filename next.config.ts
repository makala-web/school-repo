import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep server-only native/database packages as real production externals.
  // Netlify's Next runtime must resolve the generated Prisma client and Argon2
  // package from node_modules instead of a Turbopack hash alias.
  serverExternalPackages: ["@prisma/client", "argon2"],
  /* Production builds must fail on TypeScript errors. */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // PWA Configuration
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
