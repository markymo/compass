# OnPro As-Built Deployment Architecture & DevOps Reference

**Document Version:** 1.0.0 (As-Built Audit)  
**Audit Date:** 2026-08-29  
**Status:** Baseline Documentation (Uncommitted Report)

---

## 1. Executive Summary

This document establishes the precise **as-built** architecture and operational mechanics of the OnPro (Compass) deployment pipeline.

```
[ Developer / Worktree ]
           │
           ├── (git push origin <feature-branch>)
           │         │
           │         ▼
           │   [ Vercel Preview Build ]
           │         │
           │         ├── Target: Preview (isolated URL: compass-git-<branch>-*.vercel.app)
           │         ├── DB: Shared Neon Staging Database
           │         └── Custom Domain: NONE (does NOT touch dev.onpro.tech)
           │
           ├── (git push origin dev)
           │         │
           │         ▼
           │   [ Vercel Staging Build ]
           │         │
           │         ├── Target: Preview (assigned to gitBranch: 'dev')
           │         ├── DB: Shared Neon Staging Database (runs migrate deploy + seed)
           │         └── Custom Domains: https://dev.onpro.tech & https://dev.coparity.tech
           │
           └── (GitHub PR: dev ➔ main ➔ "Merge pull request")
                     │
                     ▼
               [ Vercel Production Build ]
                     │
                     ├── Target: Production (assigned to productionBranch: 'main')
                     ├── DB: Neon Production Database (runs migrate deploy if ALLOW_PROD_MIGRATIONS=true)
                     └── Custom Domains: https://onpro.tech & https://coparity.tech
```

### Key Finding on `dev.onpro.tech`
The concern that feature branch Preview deployments compete for or overwrite `dev.onpro.tech` is **unfounded under the current configuration**.
In Vercel Project Domain settings, `dev.onpro.tech` is **statically bound to `gitBranch: "dev"`**. Only builds generated directly from the `dev` branch are assigned the `dev.onpro.tech` domain alias. Feature branches receive unique, isolated preview hostnames (`compass-git-<branch>-*.vercel.app`) and cannot displace `dev.onpro.tech`.

---

## 2. Repository & Branch Model

### Repository Identification
- **GitHub Repository:** `markymo/compass`
- **Git Remote URL:** `https://github.com/markymo/compass.git`
- **Default Branch:** `main` (`remotes/origin/HEAD -> origin/main`)

### Branch Roles & Deployment Mapping

| Branch Name / Pattern | Role | Vercel Target | Domain / Hostname Binding | Database Connected |
| :--- | :--- | :--- | :--- | :--- |
| `main` | Production source of truth | `production` | `https://onpro.tech`<br>`https://coparity.tech`<br>`https://compass-sigma-ten.vercel.app` | Neon Production DB |
| `dev` | Integration / Staging source of truth | `preview` | `https://dev.onpro.tech`<br>`https://dev.coparity.tech`<br>`https://compass-git-dev-*.vercel.app` | Neon Staging DB |
| `wave04/*`, `feat/*`, etc. | Isolated feature / worker branches | `preview` | `https://compass-git-<branch-slug>-*.vercel.app`<br>`https://compass-<deployment-hash>-*.vercel.app` | Neon Staging DB |

### CI/CD Trigger Matrix

| Event | GitHub Actions (`ci.yml`) | Vercel Build Triggered? | Resulting Deployment |
| :--- | :--- | :--- | :--- |
| `git push origin <feature-branch>` | **No** (CI only watches `main`, `dev`) | **Yes** (Vercel Git Integration) | Isolated Preview URL |
| `git push origin dev` | **Yes** (Runs typecheck + vitest) | **Yes** (Vercel Git Integration) | Staging Deployment (`dev.onpro.tech`) |
| `git push origin main` / PR Merge to `main` | **Yes** (Runs typecheck + vitest) | **Yes** (Vercel Git Integration) | Production Deployment (`onpro.tech`) |
| Open Pull Request targeting `dev` or `main` | **Yes** (Runs typecheck + vitest) | No additional build (links existing preview) | PR status check attached |

---

## 3. Vercel Architecture & Domain Configuration

### Vercel Project Identity
- **Project ID:** `prj_fn1YW7MUFiauSEZQLkL7vHTExol1`
- **Project Name:** `compass`
- **Owner / Team:** `marks-projects-3dd0d5e3` (Mark's projects)
- **Account User:** `mark-5552`
- **Framework Preset:** `Next.js` (Node.js 24.x runtime configured in project settings)
- **Build Command:** `npm run vercel:build` (`node scripts/vercel-build.mjs`)

### Custom Domain Routing Table (Verified via Vercel API)

```json
[
  { "name": "dev.onpro.tech", "gitBranch": "dev", "apexName": "onpro.tech", "verified": true },
  { "name": "dev.coparity.tech", "gitBranch": "dev", "apexName": "coparity.tech", "verified": true },
  { "name": "onpro.tech", "gitBranch": null, "apexName": "onpro.tech", "verified": true },
  { "name": "coparity.tech", "gitBranch": null, "apexName": "coparity.tech", "verified": true },
  { "name": "compass-sigma-ten.vercel.app", "gitBranch": null, "apexName": "vercel.app", "verified": true }
]
```

### Analysis of `dev.onpro.tech` Behavior
1. **Static Branch Binding:** `dev.onpro.tech` has `gitBranch: "dev"`. Vercel automatically assigns this domain *only* when a deployment is created from the `dev` branch.
2. **Preview Branch Isolation:** When a feature branch like `wave04/onp-28-f205-override` is pushed, Vercel creates a Preview deployment and assigns it an automatic branch alias: `compass-git-wave04-onp-28-f205-override-marks-projects-3dd0d5e3.vercel.app`.
3. **No Domain Racing:** Because domain assignment is gated on `gitBranch === "dev"`, a feature branch completing its build after a `dev` build **cannot** steal or displace `dev.onpro.tech`.
4. **Current Live Deployment for `dev.onpro.tech`:**
   - **Deployment ID:** `dpl_WdXh9XJ8DUeLWYsXaTswfLhx6YXP`
   - **Target URL:** `https://compass-nu1mj3gpy-marks-projects-3dd0d5e3.vercel.app`
   - **Branch:** `dev`
   - **Commit SHA:** `79bb4fd` (`fix(prov-01): ensure SHARED workbench questions pass robust lastValidated Date objects`)
   - **Created:** 2026-08-29T18:37:49Z (BST 19:37:49)

---

## 4. Production Deployment Workflow

### Current Production State
- **Live Production Deployment ID:** `dpl_GVgbvydYay1MUc5tjxWFNjppLu12`
- **Target URL:** `https://compass-1wtp1ch37-marks-projects-3dd0d5e3.vercel.app`
- **Serving Domains:** `https://onpro.tech`, `https://coparity.tech`, `https://compass-sigma-ten.vercel.app`
- **Source Branch:** `main`
- **Commit SHA:** `d53491c` (`Merge pull request #261 from markymo/dev`)
- **Deployed At:** 2026-08-21T09:15:50Z (BST 10:15:50)

### The "Clicking Buttons in GitHub" Journey
When Mark promotes code from staging to production, the actual step-by-step sequence is:

1. **Navigate to GitHub:** Open `https://github.com/markymo/compass/pulls`.
2. **Open PR (`dev` ➔ `main`):** Create a Pull Request comparing base: `main` ⬅ compare: `dev`.
3. **Automated CI Validation:** GitHub Actions executes `.github/workflows/ci.yml` (`npm run typecheck` and `npm run test`) against the PR merge commit.
4. **Merge Decision:** Mark clicks **"Merge pull request"**, then clicks **"Confirm merge"**.
5. **Webhook Trigger:** GitHub sends a push event on `main` to Vercel.
6. **Vercel Build Execution:**
   - Vercel spawns a container with `VERCEL_ENV=production`.
   - Runs `npm run vercel:build` (`node scripts/vercel-build.mjs`).
   - Checks `ALLOW_PROD_MIGRATIONS === "true"` (configured in Vercel Production Environment Variables).
   - Runs `npx prisma migrate deploy` with up to 4 retries against the Neon Production Database.
   - Executes `npx next build`.
7. **Atomic Traffic Switch:** Vercel routes all `onpro.tech` traffic to the new build artifact.

### Rollback Mechanisms
1. **Vercel Dashboard Instant Rollback (Zero-Build Rollback):**
   - Navigate to `https://vercel.com/marks-projects-3dd0d5e3/compass/deployments`.
   - Locate the previous stable Production deployment (e.g. `dpl_GVgbvydYay1MUc5tjxWFNjppLu12`).
   - Click the three dots `...` and select **"Instant Rollback"** (or **"Promote to Production"**).
   - Traffic instantly flips back to the previous bundle in < 2 seconds.
2. **Git Revert Rollback:**
   - Run `git revert -m 1 <merge-commit-sha>` on `main` and push to `origin/main`.
   - Triggers a new clean production deployment.

---

## 5. Database & Environment Configuration

### Neon Database Connectivity Model

```
Vercel Scope: PREVIEW (dev branch + all feature branches)
  │
  ├── DATABASE_URL ──► Neon Staging Database Endpoint (ep-holy-paper-*)
  └── DIRECT_URL   ──► Neon Staging Direct Endpoint

Vercel Scope: PRODUCTION (main branch)
  │
  ├── DATABASE_URL ──► Neon Production Database Endpoint (ep-solitary-mouse-*)
  └── DIRECT_URL   ──► Neon Production Direct Endpoint
```

### Environment Variable Scopes Matrix

| Environment Variable | Configured Scopes | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `Preview`, `Production` | Prisma connection pooler URL (points to Staging for Preview; Production for Production) |
| `DIRECT_URL` | `Preview`, `Production` | Direct non-pooled DB URL for migrations and DDL |
| `ALLOW_PROD_MIGRATIONS` | `Production` | Set to `"true"`. Authorizes `scripts/vercel-build.mjs` to run `migrate deploy` on production |
| `APP_ENV` | `Preview`, `Production` | Designates application environment context (`staging` / `production`) |
| `BLOB_STORE_ID` | `Development`, `Preview`, `Production` | Vercel Blob store IDs partitioned by environment |
| `PRIVATE_BLOB_READ_WRITE_TOKEN` | `Preview`, `Production` | Storage auth token for private document storage |
| `AUTH_SECRET` | `Development`, `Preview`, `Production` | NextAuth encryption secret |
| `COMPANIES_HOUSE_API_KEY` | `Preview`, `Production` | Registry connector API key |
| `OPENAI_API_KEY` | `Development`, `Preview`, `Production` | AI enrichment API key |
| `RESEND_API_KEY` | `Development`, `Preview`, `Production` | Email dispatch API key |
| `SENTRY_*` | `Preview`, `Production` | Error tracking and observability DSNs |

### Migration Execution Mechanics (`scripts/vercel-build.mjs`)
- **Preview Environment (`VERCEL_ENV === "preview"`):**
  - Always executes `npx prisma migrate deploy` with 4 retries (10s backoff for cold starts).
  - Includes a fallback resolve handler for legacy migration `20260717200000_remove_legacy_documents`.
  - If `VERCEL_GIT_COMMIT_REF === "dev"`, executes `npm run db:seed:dev`.
- **Production Environment (`VERCEL_ENV === "production"`):**
  - Checks `process.env.ALLOW_PROD_MIGRATIONS === "true"`. If true, runs `npx prisma migrate deploy`.
  - If `SEED_PROD === "true"`, runs seed (default is unset / false).
- **Prisma `db push` Status:** `db push` is **strictly prohibited and completely absent** from the automated build script and package scripts.

---

## 6. Empirical Verification: Recent Wave 04 Deployments

To validate the model, five recent Wave 04 feature branch deployments were audited directly against Vercel's API records:

| Branch Name | Commit SHA | Deployment ID | Finished Build | Custom Alias Assigned | Served `dev.onpro.tech`? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wave04/onp-18-fi-questionnaire` | `3f71a2c` | `dpl_DeoFky9ucQgtArQvXBKhTftiNg9T` | 21:28 BST | `compass-git-wave04-onp-18-fi-que-989e4c-*.vercel.app` | **No** |
| `wave04/onp-28-f205-override` | `5743261` | `dpl_8aSHLjvfUtwAJLg6vvdw6Ms2NHP1` | 21:52 BST | `compass-git-wave04-onp-28-f205-override-*.vercel.app` | **No** |
| `wave04/onp-55-f235-multivalue` | `8a6ec75` | `dpl_FCZPybVeec23uQHgTm4GE1yHJqDL` | 21:52 BST | `compass-git-wave04-onp-55-f235-m-f66430-*.vercel.app` | **No** |
| `wave04/onp-54-65-composite-lifecycle`| `61a1bdd` | `dpl_8CpV7AsiBf8mVrcbCyqnGFHhaudw` | 21:52 BST | `compass-git-wave04-onp-54-65-com-153738-*.vercel.app` | **No** |
| `wave04/onp-21-f274-party` | `5ca6b1a` | `dpl_Ct7ezWQoyQ7YKNottXStXwrckHX5` | 21:52 BST | `compass-git-wave04-onp-21-f274-party-*.vercel.app` | **No** |

**Conclusion:** All five feature branches built successfully in parallel at 21:52 BST, received their own unique preview URLs, and **zero feature branches touched or altered `dev.onpro.tech`**, which remained serving commit `79bb4fd` from `dev`.

---

## 7. Observed DevOps Risks & Ambiguities

### High Risk
1. **Shared Staging Database Across All Previews:**
   - *Observation:* Vercel applies the same `Preview` environment variables (including `DATABASE_URL`) to all feature branches.
   - *Risk:* Every feature branch connects to the **same Neon Staging database**. Furthermore, `scripts/vercel-build.mjs` runs `npx prisma migrate deploy` during preview builds. If a feature branch introduces an unvetted or destructive migration, pushing that branch to GitHub will immediately apply that migration to the shared Staging database used by `dev.onpro.tech`.

### Medium Risk
2. **Lack of GitHub CI on Feature Branch Pushes:**
   - *Observation:* `.github/workflows/ci.yml` is configured with `on: push: branches: [main, dev]`.
   - *Risk:* When developers push to feature branches, GitHub Actions does NOT run typechecking or unit tests. Only Vercel builds the branch. If a branch has TypeScript or test failures, they are only caught when a PR targeting `dev` is opened or when the branch is tested locally.
3. **Automated Production Migration Execution without Dry-Run Gate:**
   - *Observation:* `ALLOW_PROD_MIGRATIONS="true"` is enabled in Production environment variables.
   - *Risk:* As soon as a PR is merged into `main`, migrations run automatically during the build. If a migration fails halfway or locks a large table, production build fails or suffers downtime during the deployment phase.

### Low Risk
4. **Dual Apex Domain Configuration:**
   - *Observation:* Both `onpro.tech` and `coparity.tech` are bound as production domains without an explicit 301 canonical redirect rule.
   - *Risk:* Minor SEO and cookie partitioning ambiguity between the legacy `coparity.tech` domain and the primary `onpro.tech` brand.

---

## 8. Recommended Cleaner Future Model (Discussion Only)

```
[ Feature Branch ]
        │
        ▼
[ GitHub CI: typecheck + vitest ]
        │
        ▼
[ Vercel Preview Deployment ] ──► (Isolated Neon DB Branch via Neon Vercel Integration)
        │
        ▼
[ Merge to 'dev' ]
        │
        ▼
[ Vercel Staging Deployment ] ──► dev.onpro.tech ──► Neon Staging DB
        │
        ▼
[ PR Review & Approval ]
        │
        ▼
[ Merge to 'main' ]
        │
        ├── Step 1: Pre-deployment DB Migration Step (CI Gated)
        └── Step 2: Vercel Production Deployment ──► onpro.tech ──► Neon Production DB
```

*Key future improvements:*
1. Enable Neon Database Branching for Vercel Previews so feature branches get ephemeral isolated DB copies.
2. Expand `.github/workflows/ci.yml` to trigger on all branches (`on: push: branches: ['**']`).
3. Set up canonical domain redirection from `coparity.tech` ➔ `onpro.tech`.
