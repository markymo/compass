import * as Sentry from "@sentry/nextjs";

function getClientTracesSampleRate(): number {
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  if (env === "production") return 0.05; // Production client: 5%
  if (env === "staging") return 1.0;     // Staging: 100%
  if (env === "preview") return 0.5;     // Preview: 50%
  return 1.0;                            // Local / Development: 100%
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Environment-specific trace sampling rate
  tracesSampleRate: getClientTracesSampleRate(),

  // Defensive Privacy Configuration
  sendDefaultPii: false,

  // Session Replay disabled completely
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event) {
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
    }
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
