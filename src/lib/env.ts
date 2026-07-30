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
