import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
    }
    return event;
  },
});
