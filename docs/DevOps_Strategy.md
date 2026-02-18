# Compass DevOps & Database Strategy (Vercel + Neon + Prisma) — Hardened v2

This document outlines a safe, repeatable strategy for Compass deployments and database lifecycle management after an accidental data deletion triggered via a Prisma command.

## 0. Principles (Non-Negotiables)

*   **Production (`main`) is protected**: cannot be reset/deleted; local machines must not have write credentials to it.
*   **Prisma “migrations” are the only way** schema changes reach Preview/Production.
*   **Preview DBs are disposable**; Dev is “safe to break”; Prod is “boring and durable”.
*   **Guard rails are code**, not memory.

## 1. Environment Strategy

We use a three-tier model aligned to Vercel environments and Neon branches.

| Environment | Purpose | Vercel Scope | Neon Branch | URL |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | Local coding + experiments | `development` | `dev` (or per-dev) | `localhost:3000` |
| **Preview** | QA / UAT per PR | `preview` | `preview/pr-<number>` (auto) | `*.vercel.app` |
| **Production** | Live end-user traffic | `production` | `main` | `compass.app` |

**Key feature**: Vercel + Neon integration can auto-create a new Neon DB branch per Preview Deployment.

## 2. Neon Database Management

### 2.1 Branching Strategy

*   **`main`**: Production (“gold copy”) — protected
*   **`dev`**: Persistent dev branch
*   **`preview/pr-*`**: Ephemeral branches created automatically per PR

### 2.2 Protect Production (`main`) — MUST DO FIRST

*   **Enable Protected Branch** for `main` in Neon:
    *   Prevents accidental deletes/resets of main
    *   Adds friction to destructive operations

### 2.3 Backups & Recovery (PITR + Secondary Dumps)

*   **Primary**: Neon Point-in-Time Restore (restore window)
    *   Configure restore window to ≥ 7 days (or highest allowed)
*   **Recovery from an accidental wipe**:
    1.  Restore to timestamp just before incident
    2.  Verify restored branch
    3.  Promote/switch production to restored branch
*   **Secondary (recommended)**: nightly `pg_dump` to S3/R2 (GitHub Action)
    *   Protects against “noticed too late” beyond restore window
    *   Avoids platform lock-in risk

### 2.4 Role Separation (Runtime vs Migrator) — HIGH VALUE

Create two DB roles/users:

1.  **`app_user` (runtime)**: normal CRUD only; no DDL
2.  **`migrator_user` (CI only)**: can run schema migrations (DDL)

**Outcome**: even if the app connects somewhere incorrectly, it can’t drop tables.

## 3. Prisma Strategy (What Prisma Does & Where It Runs)

Prisma has 3 parts:
1.  **Schema file** (`schema.prisma`) — blueprint
2.  **Prisma Client** (`@prisma/client`) — runtime ORM (safe CRUD)
3.  **Prisma CLI** (`migrate` / `db push`) — schema changes (dangerous if mis-pointed)

### 3.1 Migration Rules

| Environment | Command | Status |
| :--- | :--- | :--- |
| **Dev** | `prisma migrate dev` | ✅ Allowed |
| **Preview/Prod** | `prisma migrate deploy` | ✅ Allowed |
| **Prod** | `prisma db push` | ❌ NEVER |
| **Shared Dev** | `prisma db push` | ❌ Avoid (allowed only for throwaway DBs) |

### 3.2 Connection URLs

*   `DATABASE_URL`: runtime connection (often pooled)
*   `DIRECT_URL`: direct connection for migrations (recommended)

## 4. Vercel Build / Deploy Strategy (Make It Automatic + Safe)

### Current state

Your build script is `"build": "prisma generate && next build"`.
So Vercel currently runs:
1.  `prisma generate`
2.  `next build`

…but does not run migrations.

### Target state

We introduce a dedicated Vercel build script that:
1.  Runs `prisma generate`
2.  Runs `prisma migrate deploy` for Preview
3.  Optionally runs `prisma migrate deploy` for Production (gated)
4.  Runs `next build`

This ensures Preview DB branches are always migrated to match the PR.

## 5. Required Repo Changes

### 5.1 Update `package.json` scripts

Add these scripts (keep existing ones):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint",

    "prisma:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",

    "db:seed:dev": "ts-node -r tsconfig-paths/register scripts/seed-dev.ts",
    "db:seed:preview": "ts-node -r tsconfig-paths/register scripts/seed-preview.ts",

    "vercel:build": "node scripts/vercel-build.mjs"
  }
}
```

### 5.2 Add `scripts/vercel-build.mjs` (Guard-Railed Build Pipeline)

Create: `scripts/vercel-build.mjs`

```javascript
import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function mustHave(name) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
}

const vercelEnv = process.env.VERCEL_ENV; // "preview" | "production" | (undefined locally)
console.log("VERCEL_ENV =", vercelEnv || "(not set)");

mustHave("DATABASE_URL");

// Always generate Prisma Client for Next build
run("npx prisma generate");

// Run migrations on Preview automatically
if (vercelEnv === "preview") {
  console.log("Running Preview migrations…");
  run("npx prisma migrate deploy");
}

// Production migrations are gated (prevents accidental prod schema changes)
if (vercelEnv === "production") {
  if (process.env.ALLOW_PROD_MIGRATIONS === "true") {
    console.log("Running Production migrations…");
    run("npx prisma migrate deploy");
  } else {
    console.log("Skipping Production migrations (ALLOW_PROD_MIGRATIONS != true).");
  }
}

// Build Next
run("npx next build");
```

### 5.3 Vercel project setting

Set Vercel Build Command to: `npm run vercel:build`
(Install command can stay default.)

## 6. Vercel Environment Variables (Operational Setup)

Set per environment:

**Preview**
*   `DATABASE_URL` (from Neon integration branch)
*   `DIRECT_URL` (direct connection; recommended)
*   (optional) `SEED_PREVIEW=true`

**Production**
*   `DATABASE_URL` (points to `main`)
*   `DIRECT_URL` (direct connection; recommended)
*   `ALLOW_PROD_MIGRATIONS=false` by default (set to `true` only when ready)

**Policy**: local `.env` must never contain prod credentials.

## 7. Data Strategy (Seeding)

### 7.1 `db:seed:dev` (idempotent)
*   Uses `upsert` everywhere
*   Loads reference data + demo tenants + demo users

### 7.2 `db:seed:preview` (minimal)
*   Tiny dataset for QA click-through
*   Optional, kept fast

## 8. Immediate Action Plan (Execute Carefully)

### Phase 1 — Safety First (Neon)
1.  Protect Neon `main` branch (Protected Branch)
2.  Set Neon restore window ≥ 7 days
3.  (Optional but recommended) Implement nightly `pg_dump` to S3/R2

### Phase 2 — Prisma Discipline
1.  Stop using `prisma db push` (except on throwaway DBs)
2.  Ensure migrations exist and are committed (`prisma/migrations`)
3.  Add role separation (`app_user` vs `migrator_user`) if feasible now

### Phase 3 — Vercel Automation
1.  Add scripts (`vercel:build`, `vercel-build.mjs`)
2.  Change Vercel build command to `npm run vercel:build`
3.  Confirm Preview deployments get:
    *   New Neon branch
    *   Migrations applied
    *   App deploy succeeds

### Phase 4 — Controlled Production
1.  Keep `ALLOW_PROD_MIGRATIONS=false`
2.  When ready to deploy schema change:
    *   Set `ALLOW_PROD_MIGRATIONS=true` temporarily
    *   Deploy
    *   Set back to `false`

## 9. “Rules to Live By” (Stick This on the Wall)

1.  **Protect `main`.**
2.  **Local never has prod credentials.**
3.  **Runtime DB user cannot do DDL.**
4.  **Schema changes only via migrations.**
## 10. Verification Log
### 2026-02-17 Vercel Build Script
- **Action**: Ran `npm run vercel:build` locally.
- **Result**: Success. Correctly skipped migrations (VERCEL_ENV unset) and ran `next build`.
### 2026-02-17 Unified Seeder
- **Action**: Ran `npm run db:seed:dev`.
- **Result**: Success. Restored FIs, Clients (Acme), Suppliers (G-SIB), and Users.
## 11. Appendix: Vercel Configuration Guide (Novice Friendly)

Follow these exact steps to enable the "Hardened" DevOps pipeline.

### Step 1: Change the Build Command
This tells Vercel to use our new safe build script (`scripts/vercel-build.mjs`) instead of the default.

1.  Log in to your **Vercel Dashboard**.
2.  Select the **Compass** project.
3.  Go to **Settings** (top tab) -> **General**.
4.  Scroll down to **Build & Development Settings**.
5.  Find **Build Command**.
6.  Toggle the switch to **Override**.
7.  In the text box, type exactly:
    ```bash
    npm run vercel:build
    ```
8.  Click **Save**.

### Step 2: Connect Neon Integration
This enables the "Branching" magic where Vercel creates a separate DB for every Pull Request.

1.  Go to the **Storage** tab (top of project page).
2.  Find **Neon** (or click "Connect Store" -> Neon if not connected).
3.  If already connected:
    *   Look for a setting called **Enable Branching** or "Database Branching".
    *   Ensure it is **Enabled**.
4.  If not connected:
    *   Click **Connect**.
    *   Follow the prompts to link your Neon account.
    *   **Crucial**: When asked, make sure to select the option to **Enable Branching** or "Create a branch for every deployment".

### Step 3: Verify
1.  Push a small change to a new branch (e.g., `git checkout -b test-deploy`).
2.  Open a Pull Request on GitHub.
3.  Vercel will start a deployment.
4.  Check the "Logs" in Vercel. You should see:
    ```
    > node scripts/vercel-build.mjs
    VERCEL_ENV = preview
    Running Preview migrations...
    ```
5.  If you see that, **IT WORKS!**