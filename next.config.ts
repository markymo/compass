import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  env: {
    NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://vercel.com/api/blob',
  },
};

export default withSentryConfig(nextConfig, {
  // Silent Sentry build output to avoid noise in build logs
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable telemetry uploads if no auth token is provided at build time
  disableLogger: true,
});
