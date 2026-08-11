import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Guard Node.js built-in performance.measure against Next.js Turbopack negative time stamp errors
    if (typeof performance !== "undefined" && typeof performance.measure === "function") {
      const originalMeasure = performance.measure.bind(performance);
      performance.measure = function (name?: string, startMarkOrOptions?: any, endMark?: string) {
        try {
          return originalMeasure(name as any, startMarkOrOptions, endMark);
        } catch (err: any) {
          if (err && typeof err.message === "string" && (err.message.includes("negative time stamp") || err.message.includes("negative duration"))) {
            return {} as PerformanceMeasure;
          }
          throw err;
        }
      };
    }

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
