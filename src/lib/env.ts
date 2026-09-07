/**
 * Environment detection utilities for distinguishing production vs non-production environments.
 */

export function isNonProductionEnv(host?: string | null): boolean {
  // Check explicit environment variables
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "").toLowerCase();
  if (["dev", "development", "staging", "preview", "test"].includes(appEnv)) {
    return true;
  }

  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  if (["development", "preview"].includes(vercelEnv)) {
    return true;
  }

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Check request Host header if available
  if (host) {
    const normalizedHost = host.toLowerCase().split(":")[0]; // strip port if present

    // Production host check
    if (normalizedHost === "onpro.tech" || normalizedHost === "www.onpro.tech" || normalizedHost === "app.onpro.tech") {
      return false;
    }

    if (
      normalizedHost.includes("dev.onpro.tech") ||
      normalizedHost.includes("staging") ||
      normalizedHost.includes("localhost") ||
      normalizedHost.includes("127.0.0.1") ||
      normalizedHost.endsWith(".vercel.app") ||
      normalizedHost.endsWith(".local")
    ) {
      return true;
    }
  }

  // Default to true if explicitly running in non-production, otherwise check NODE_ENV
  return process.env.NODE_ENV !== "production";
}

export function isDevSubdomain(host?: string | null): boolean {
  if (!host) return false;
  const normalizedHost = host.toLowerCase().split(":")[0];
  return (
    normalizedHost.includes("dev.onpro.tech") ||
    normalizedHost.includes("staging") ||
    normalizedHost.includes("localhost") ||
    normalizedHost.includes("127.0.0.1")
  );
}

/**
 * Feature flag for showing public marketing pages.
 * Defaults to false so public pages remain hidden behind a Coming Soon gate until polished.
 */
export function isPublicSiteEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SITE === "true" ||
    process.env.ENABLE_PUBLIC_SITE === "true"
  );
}

/**
 * Resolves the application base URL dynamically.
 * In a request context (Server Action / Server Component), it uses the incoming HTTP request host headers,
 * ensuring dev.onpro.tech, onpro.tech, preview PR branches, and localhost generate accurate links.
 */
export async function getAppBaseUrl(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const reqHeaders = await headers();
    const host = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
    if (host) {
      const proto = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Outside request context (e.g. background job, CLI)
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

