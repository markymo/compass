# Manual Playwright UAT Execution Guide

## Overview & Purpose

Playwright User Acceptance Testing (UAT) in OnPro is currently executed **manually from a developer laptop** against the canonical deployed staging environment.

It is **NOT** currently part of the automated GitHub Actions CI pipeline.

- **GitHub Actions CI** operates as the code-quality gate:
  - TypeScript typecheck (`tsc --noEmit`)
  - Vitest test suite (`vitest run`)
- **Playwright UAT** operates as a developer-controlled end-to-end acceptance gate against the live deployed staging environment:
  - **Canonical Staging Target**: `https://dev.onpro.tech`
  - **Staging Database**: Vercel `preview` environment Neon database

---

## Architecture

```text
Developer Laptop
   │
   ├── npm run uat:seed
   │       ↓  (direct SQL via Prisma over TLS)
   │   Staging Neon Database (neondb)
   │   [Writes non-secret manifest: playwright/.uat/fixture.json]
   │
   ├── npm run uat:auth
   │       ↓  (HTTPS browser login against /login)
   │   https://dev.onpro.tech
   │   [Saves reusable sessions: playwright/.auth/*.json]
   │
   └── npm run uat:permissions
           ↓  (HTTPS browser sessions navigating /app)
       https://dev.onpro.tech
```

### Key Architectural Invariants
1. **Playwright Never Needs Direct Database Access**: Playwright tests interact strictly with `https://dev.onpro.tech` via browser UI and HTTPS requests.
2. **Deterministic & Convergent Seeding**: The seeding script (`scripts/uat-seed.ts`) is idempotent. Running it repeatedly repairs drift without duplicating records.
3. **Isolated Synthetic Namespace**: All seeded entities use the `uat_*` prefix or `uat+*@onpro.tech` emails. Real customer and demo data are untouched.
4. **Independent Allow-List Gate**: The seeder enforces that `DATABASE_URL` matches independent local allow-list variables (`UAT_ALLOWED_DATABASE_HOST` and `UAT_ALLOWED_DATABASE_NAME`) to prevent accidental production execution.

---

## Prerequisites & Environment Setup

All local UAT secrets should be stored in a local, gitignored file named `.env.uat.local`:

```bash
# .env.uat.local (Strictly Gitignored)
UAT_SEED_ALLOWED=true
APP_ENV=staging
PLAYWRIGHT_BASE_URL=https://dev.onpro.tech

# Independent Safety Allow-List (must match target DB host and name)
UAT_ALLOWED_DATABASE_HOST=ep-holy-paper-abzmtgvg.eu-west-2.aws.neon.tech
UAT_ALLOWED_DATABASE_NAME=neondb

# Fresh synthetic password for the 9 UAT personas
UAT_PASSWORD=YourStrongSyntheticPasswordHere!2026

# Injected from Vercel preview environment (via Vercel CLI / API)
DATABASE_URL=postgresql://...
```

> [!IMPORTANT]
> Never commit `.env.uat.local`, `playwright/.auth/`, or `playwright/.uat/` to version control. They are pre-configured in `.gitignore`.

---

## Step-by-Step Execution Workflow

### Step 1: Converge the Staging Fixture (`npm run uat:seed`)

Runs the deterministic seeder against the staging database to converge the 9 canonical personas, 3 tenant organisations, 2 ClientLEs, 2 relationships, and baseline claims:

```bash
node -e "
require('dotenv').config({ path: '.env.uat.local' });
const { execSync } = require('child_process');
execSync('npm run uat:seed', { stdio: 'inherit', env: process.env });
"
```

**Expected Seed Output**:
- Organizations: 3 (`UAT Client Org A`, `UAT Client Org B`, `UAT Supplier Org A`)
- ClientLEs: 2 (`UAT Alpha Limited`, `UAT Beta Limited` with null LEI/GLEIF)
- Relationships: 2 (`Relationship Alpha`, `Relationship Beta`)
- Users & Memberships: 9 (strict 1:1 role isolation per user)
- Output Manifest: `playwright/.uat/fixture.json`

---

### Step 2: Authenticate All 9 Personas (`npm run uat:auth`)

Launches Playwright setup to log in through the real `/login` UI on `https://dev.onpro.tech` for each persona, saving reusable session cookies to `playwright/.auth/*.json`:

```bash
node -e "
require('dotenv').config({ path: '.env.uat.local' });
const { execSync } = require('child_process');
execSync('npm run uat:auth', { stdio: 'inherit', env: process.env });
"
```

**Personas Authenticated**:
1. `systemAdmin` (`uat+system-admin@onpro.tech`) → `playwright/.auth/system-admin.json`
2. `clientOrgAdminA` (`uat+client-org-admin-a@onpro.tech`) → `playwright/.auth/client-org-admin-a.json`
3. `clientOrgMemberA` (`uat+client-org-member-a@onpro.tech`) → `playwright/.auth/client-org-member-a.json`
4. `leAdminAlpha` (`uat+le-admin-alpha@onpro.tech`) → `playwright/.auth/le-admin-alpha.json`
5. `leUserAlpha` (`uat+le-user-alpha@onpro.tech`) → `playwright/.auth/le-user-alpha.json`
6. `leUserBeta` (`uat+le-user-beta@onpro.tech`) → `playwright/.auth/le-user-beta.json`
7. `supplierOrgAdminA` (`uat+supplier-org-admin@onpro.tech`) → `playwright/.auth/supplier-org-admin-a.json`
8. `relationshipAdminAlpha` (`uat+relationship-admin-alpha@onpro.tech`) → `playwright/.auth/relationship-admin-alpha.json`
9. `relationshipUserAlpha` (`uat+relationship-user-alpha@onpro.tech`) → `playwright/.auth/relationship-user-alpha.json`

---

### Step 3: Run the Browser Permission Regression Suite (`npm run uat:permissions`)

Executes all 13 boundary regression tests against `https://dev.onpro.tech` using the saved storage states:

```bash
node -e "
require('dotenv').config({ path: '.env.uat.local' });
const { execSync } = require('child_process');
execSync('npm run uat:permissions', { stdio: 'inherit', env: process.env });
"
```

**Permission Test Coverage**:
- **System Admin**: Platform administration access permitted (`/app/admin/permissions`); operational Master Data access forbidden.
- **Client Org**: Structural visibility on homepage permitted (`UAT Client Org A`, `UAT Alpha Limited`); operational relationship data and Master Data forbidden.
- **Client LE**: `LE_ADMIN` and `LE_USER` can open Alpha Master Data (`/app/le/<alpha>/master`); cross-entity access to Beta Master Data forbidden.
- **Supplier**: `Supplier ORG_ADMIN` sees zero customer relationships; `Relationship Admin Alpha` and `Relationship User Alpha` access Relationship Alpha but are isolated from Relationship Beta.

---

## Test Failure Diagnostics

When a test fails, Playwright artifacts are automatically saved:
- **Screenshots**: Captured on failure under `test-results/`
- **Traces**: Captured on first retry under `test-results/`

To inspect a trace file locally:
```bash
npx playwright show-trace test-results/<failed-test-dir>/trace.zip
```

---

## Writing New UAT Tests (Conventions)

1. **Mandatory Test Documentation Block**: Every test must include:
   ```typescript
   /**
    * WHY:
    * ...
    *
    * EXPECT:
    * ...
    *
    * IF THIS FAILS:
    * ...
    */
   ```
2. **Requirement-Style Test Names**: E.g. `LE_ADMIN Alpha cannot open Beta Master Data`.
3. **Use Manifest & Storage States**: Consume `loadUATManifest()` and `PERSONA_STORAGE_STATES` from `e2e/fixtures/uat-fixture.ts`. Do not hardcode database UUIDs.
