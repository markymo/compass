import * as Sentry from "@sentry/nextjs";

function getTracesSampleRate(): number {
  const env = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  if (env === "production") return 0.1; // Production server: 10%
  if (env === "staging") return 1.0;    // Staging: 100%
  if (env === "preview") return 0.5;    // Preview: 50%
  return 1.0;                           // Local / Development: 100%
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Environment-specific trace sampling rate
  tracesSampleRate: getTracesSampleRate(),

  // Defensive Privacy Configuration
  sendDefaultPii: false,

  // Session Replay disabled completely
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event) {
    // Strip sensitive request data
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.data;
    }
    // Strip user PII
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },

  beforeSendTransaction(event) {
    // Scrub SQL parameters & sensitive span data
    if (event.spans) {
      for (const span of event.spans) {
        if (span.data) {
          delete span.data["db.statement.parameters"];
          delete span.data["http.request.headers"];
          delete span.data["http.response.headers"];
        }
      }
    }
    return event;
  },
});
