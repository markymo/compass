# OnPro Phase 0 Observability Operating Note

> [!NOTE]
> **Phase 0 Operational Baseline**: Active for Next.js 16, React 19, Prisma 6, and Neon Postgres across Local, Preview, Staging, and Production environments.

---

## 1. Accessing Vendor Observability Dashboards

### A. Vercel Speed Insights (Frontend Real-User Monitoring)
- **Dashboard URL**: [Vercel Project Dashboard](https://vercel.com/) -> Project **compass** -> **Speed Insights** tab.
- **Metrics Tracked**: Real-user Core Web Vitals (**INP**, **LCP**, **CLS**, **TTFB**) broken down by page route, device type, browser, and region.
- **Rollback / Disable**: Remove `<SpeedInsights />` from [src/app/layout.tsx](file:///opt/code/coparity/src/app/layout.tsx) or toggle off Speed Insights in Vercel settings.

### B. Sentry Next.js (Error Tracking & Application Tracing)
- **Dashboard URL**: [Sentry Dashboard](https://sentry.io/) -> Organization **OnPro** -> Project **compass**.
- **Metrics Tracked**: Frontend exceptions, uncaught server errors, Server Action performance spans, and correlated Prisma SQL query spans.
- **Source Maps**: Configured via `Sentry.withSentryConfig` in [next.config.ts](file:///opt/code/coparity/next.config.ts). Builds upload source maps tagged with `VERCEL_GIT_COMMIT_SHA` to map minified stack traces back to TypeScript source lines.
- **Rollback / Disable**: Remove `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` environment variables in Vercel.

### C. Neon Console (Database Infrastructure Insights)
- **Dashboard URL**: [Neon Console](https://console.neon.tech/) -> Project **OnPro Postgres** -> **Insights** tab.
- **Metrics Tracked**: Active/idle connection counts, connection pooler utilization, CPU/RAM scaling, and slow query execution plans via `pg_stat_statements`.

---

## 2. Environment Configuration & Required Variables

### Required Environment Variables:
| Variable Name | Environment Scope | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SENTRY_DSN` | Client & Server | Sentry DSN for client-side browser error & trace telemetry. |
| `SENTRY_DSN` | Server-only | Sentry DSN for Node.js server error & trace telemetry. |
| `SENTRY_ORG` | Build-time | Sentry organization identifier (`onpro`). |
| `SENTRY_PROJECT` | Build-time | Sentry project identifier (`compass`). |
| `SENTRY_AUTH_TOKEN` | Build-time secret | Authentication token for uploading TypeScript source maps during build. |
| `APP_ENV` / `NEXT_PUBLIC_APP_ENV` | All | Environment tag (`local`, `preview`, `staging`, `production`). |
| `VERCEL_GIT_COMMIT_SHA` | All | Git commit SHA used for release tagging & source map correlation. |
| `ENABLE_SENTRY_DIAGNOSTICS` | Production optional | Set to `"true"` to enable diagnostic POST endpoint in production. |

---

## 3. Environment Sampling Rates

| Environment | Tag (`APP_ENV`) | Tracing Sample Rate (`tracesSampleRate`) | Error Capture |
| :--- | :--- | :--- | :--- |
| **Local / Dev** | `local` / `development` | **100%** (`1.0`) | Active (Controlled PII) |
| **Preview** | `preview` | **50%** (`0.5`) | Active (Filtered PII) |
| **Staging** | `staging` | **100%** (`1.0`) | Active (Filtered PII) |
| **Production** | `production` | **10%** (`0.1`) server / **5%** (`0.05`) client | Active (Filtered PII) |

---

## 4. Monitored Technical Probes

Phase 0 instruments three fixed representative technical operations:

1. `probe.workbench4.load`
   - **Target**: `getWorkbench4Data()` in [src/actions/kyc-workbench.ts](file:///opt/code/coparity/src/actions/kyc-workbench.ts#L39).
   - **Category**: Read-heavy workflow (questions, schema, claims, and attachments resolution).
2. `probe.field_claim.save`
   - **Target**: `updateFieldManually()` in [src/actions/kyc-manual-update.ts](file:///opt/code/coparity/src/actions/kyc-manual-update.ts#L18).
   - **Category**: Standard write workflow (manual KYC claim verification and graph edge updates).
   - **Child Spans**: Captures `prisma:client:db_query` spans for field claim upserts.
3. `probe.output_pack.generate`
   - **Target**: `POST` handler in [src/app/api/export/output-pack/route.ts](file:///opt/code/coparity/src/app/api/export/output-pack/route.ts#L17).
   - **Category**: Heavier workflow (PDF/ZIP export generation and document stream assembly).

---

## 5. Privacy & Data Scrubbing Controls Audit

All telemetry pipelines enforce strict data protection:
- **`sendDefaultPii: false`**: User emails, names, usernames, and IP addresses are stripped in `beforeSend`.
- **Session Replay**: Disabled (`replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`).
- **Header & Request Sanitization**: Headers, cookies, authentication tokens, and request bodies are deleted in `beforeSend`.
- **SQL Parameter Masking**: Raw SQL parameters (`pg` query variables) are deleted from Prisma spans via `beforeSendTransaction`.
- **Allowlisted Span Attributes**: Only fixed safe strings (`probe.name`, `probe.type`, `field.no`) are attached to spans. User-supplied claim values, names, and filenames are strictly excluded.

---

## 6. Alerting Policy

Phase 0 uses three conservative initial alert rules in Sentry:
1. **New Unhandled Production Error**: Triggers immediately on any new uncaught production exception.
2. **Material Error Spike**: Triggers if error volume increases > 3x over 15 minutes.
3. **Extreme Probe Latency**: Triggers if an individual technical probe execution exceeds 5,000ms.

*Note: p95 latency threshold alerts are deferred until sufficient production traffic samples exist.*

---

## 7. Staging Diagnostic Verification Endpoint

System Administrators can execute verification tests in Staging via:
- `POST /api/admin/sentry-test` with Body: `{ "type": "server" }` (Triggers a controlled server exception).
- `POST /api/admin/sentry-test` with Body: `{ "type": "probe" }` (Triggers a controlled test span).

*(Enforces System Admin auth check via `checkIsSystemAdmin`. In production, disabled unless `ENABLE_SENTRY_DIAGNOSTICS=true`).*
