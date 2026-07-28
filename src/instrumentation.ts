import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Initialize Prisma OpenTelemetry instrumentation strictly in Node.js runtime
    try {
      const { PrismaInstrumentation } = await import("@prisma/instrumentation");
      // PrismaInstrumentation will auto-register with Sentry's OpenTelemetry tracer
      new PrismaInstrumentation();
    } catch (e) {
      // Non-fatal fallback if Prisma instrumentation isn't loaded
      console.warn("[Instrumentation] Failed to load Prisma instrumentation:", e);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
