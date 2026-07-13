import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  env: {
    // On Vercel deployments, VERCEL_BLOB_API_URL is set to a relative path
    // (e.g. /blob/) intended for Vercel's own edge proxy. On custom domains
    // this proxy doesn't exist, causing multipart upload parts from the
    // @vercel/blob browser client to hit 404.
    //
    // Setting NEXT_PUBLIC_VERCEL_BLOB_API_URL to the absolute URL ensures the
    // browser SDK always routes directly to the Vercel Blob API.
    NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://vercel.com/api/blob',
  },
};

export default nextConfig;

// Force restart for Prisma Schema update - FINAL SYNC 2026-04-22T13:51:00Z
