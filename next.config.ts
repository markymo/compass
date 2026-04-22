import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;

// Force restart for Prisma Schema update - FINAL SYNC 2026-04-22T13:51:00Z
