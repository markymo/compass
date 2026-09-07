# Playwright Regression Testing Guide

## 1. Overview & Purpose

In OnPro, Playwright automated testing is divided into two distinct testing layers:

```text
Playwright Testing Hierarchy
 ├── 1. UAT Permissions Matrix (e2e/permissions/*.spec.ts)
 │      └── Validates multi-tenant RBAC access boundaries across the 9 canonical personas.
 │
 └── 2. End-to-End Regression Journeys (e2e/regression/*.spec.ts)
        └── Validates complete live customer lifecycles ("Golden Entities") from blank canvas
            to registry enrichment, claim persistence, and canonical /master rendering.
```

The regression suite operates against the canonical staging environment (`https://dev.onpro.tech` and the staging database). It is designed to catch regressions in:
* Legal Entity creation & LEI/registry lookup
* Async background enrichment (GLEIF Level 1/2, Companies House, National Registries)
* Normalization & source mapping (`SourceFieldMapping`, `GleifNormalizer`)
* `FieldClaim` creation, lineage, and provenance
* Claim freshness & execution window timestamps (`assertedAt`)
* Canonical Master Data resolution (`KycStateService.resolveAllFields`)
* Structured value schemas (Addresses, Party collections, Code lists)
* `/master` UI rendering, badges, and inspection sheets

---

## 2. The 2-Tier "Golden Entity" Architecture

Testing rich registry-driven entities requires balancing speed and depth. OnPro uses a **Two-Tier Test Pattern**:

```text
                               ┌────────────────────────────────────────────────┐
                               │  Establish Blank Canvas in Test Org (Scoped)   │
                               └──────────────────────┬─────────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
       ┌───────────────────────────────┐                             ┌───────────────────────────────┐
       │   Tier 1: Deep Contract Spec  │                             │  Tier 2: Customer Journey UI  │
       │ (hornsea-enrichment-contract) │                             │   (hornsea-master-record)     │
       ├───────────────────────────────┤                             ├───────────────────────────────┤
       │ • Exercises live bootstrap    │                             │ • Exercises browser UI        │
       │ • Deeply validates 35+ fields │                             │ • Add Modal → GLEIF lookup    │
       │ • Enforces timestamp windows  │                             │ • Step 2 Team Access admin    │
       │ • Asserts structured schemas  │                             │ • Asserts representative rows │
       │ • Fast execution (~18s)       │                             │ • Fast execution (~12s)       │
       └───────────────────────────────┘                             └───────────────────────────────┘
```

### Tier 1: Deep Contract & Freshness Specification
* **File**: `e2e/regression/hornsea-enrichment-contract.spec.ts`
* **Purpose**: Performs exhaustive validation across all 35+ Master Fields populated by GLEIF and Companies House without driving 35 individual typing actions through the DOM.
* **Core Invariants Verified**:
  * **Execution Window**: Asserts `testStartedAt <= assertedAt <= enrichmentCompletedAt` on all 60+ generated `FieldClaim` records to guarantee claims are fresh and not inherited from legacy test runs.
  * **Structured Address Schema**: Validates line items, locality, postal codes, and country codes (`5 HOWICK PLACE, LONDON, SW1P 1WG, GB`).
  * **Repeating Party Arrays**: Validates Company Directors (~10 active/historical officers) and PSC (`Hornsea 1 Holdings Limited` with 75–100% control).
  * **Code Lists**: Validates UK SIC / NACE (`82990 - Other business support service activities n.e.c.`).
  * **Accounting Dates**: Validates live period end, next due date, and overdue status.

### Tier 2: Customer Journey Master Record UI
* **File**: `e2e/regression/hornsea-master-record.spec.ts`
* **Purpose**: Simulates the authentic end-user browser journey from dashboard creation to Master Record verification on `https://dev.onpro.tech`.
* **Flow**:
  1. Authenticates as `Org Admin` using pre-authenticated storage state (`playwright/.auth/client-org-admin-a.json`).
  2. Opens **Add Legal Entity** modal, searches `"Hornsea"`, selects `HORNSEA 1 LIMITED` (`2138002S3XGZ38WN5Q72`), and verifies `Verified with GLEIF`.
  3. In Step 2 (**Team Access**), assigns `Admin` role to the user and finishes setup.
  4. Opens the newly created dossier and verifies representative fields (Fields 3, 2, 138, 20, 63, 64, 5, 54, 37) on `/master`.
  5. Leaves the created entity intact on dev for manual inspection if desired.

---

## 3. Blank-Canvas & Safety Guardrails

Because regression tests perform destructive baseline preparation, strict guardrails are enforced:

### Safety Invariants
1. **Mandatory Tenant Scoping**: Every deletion query must filter strictly on `owners: { some: { partyId: testOrgId } }` where `testOrgId === '699fc2be-b7d4-4963-83fe-0e2ad9139cdd'`.
2. **Production Kill-Switch**: Tests must assert that `DATABASE_URL` does not point to a production database.
3. **No Unscoped Deletions**: Never delete `FieldClaim` or `ClientLE` by LEI or company name alone without scoping to the test organization.

### Baseline Cleanup Pattern
```typescript
async function cleanupTestOrgHornseaBaseline(orgId: string) {
    if (orgId !== '699fc2be-b7d4-4963-83fe-0e2ad9139cdd') {
        throw new Error('[SAFETY GUARD] Refusing cleanup: Org ID does not match UAT Test Org ID.');
    }

    const matchingLEs = await prisma.clientLE.findMany({
        where: {
            OR: [{ lei: HORNSEA_LEI }, { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }],
            owners: { some: { partyId: orgId } }
        },
        select: { id: true, legalEntityId: true }
    });

    const leIds = matchingLEs.map(le => le.id);
    const legalEntityIds = matchingLEs.map(le => le.legalEntityId).filter(Boolean);

    if (leIds.length > 0) {
        // 1. Delete scoped claims
        await prisma.fieldClaim.deleteMany({ where: { clientLEId: { in: leIds } } });
        // 2. End active ownership intervals
        await prisma.clientLEOwner.updateMany({ where: { clientLEId: { in: leIds }, partyId: orgId }, data: { endAt: new Date() } });
        // 3. Soft-delete and archive
        await prisma.clientLE.updateMany({ where: { id: { in: leIds } }, data: { isDeleted: true, status: 'ARCHIVED' } });
    }

    if (legalEntityIds.length > 0) {
        // Clear canonical LegalEntity claims in dev test baseline
        await prisma.fieldClaim.deleteMany({ where: { subjectLeId: { in: legalEntityIds } } });
    }
}
```

---

## 4. Execution Commands

### A. Run Headless (Standard CI / Fast Terminal)
```bash
# Run deep contract test
npx playwright test e2e/regression/hornsea-enrichment-contract.spec.ts

# Run UI master record test
npx playwright test e2e/regression/hornsea-master-record.spec.ts

# Run all regression tests
npx playwright test e2e/regression/
```

### B. Run Headed (Watch Chrome Execute in Real-Time)
```bash
npx playwright test e2e/regression/hornsea-master-record.spec.ts --headed
```

### C. Run Interactive UI Mode (Time-Travel, DOM Snapshots & Tracing)
```bash
npx playwright test e2e/regression/hornsea-master-record.spec.ts --ui
```

### D. Step-by-Step Debugging Mode (`--debug`)
```bash
npx playwright test e2e/regression/hornsea-master-record.spec.ts --debug
```
* Use <kbd>F10</kbd> to step over line-by-line.
* Use <kbd>F8</kbd> to resume to the next breakpoint or test completion.
* Click on line numbers in the Playwright Inspector to set breakpoints.
* Use the **Pick Locator (🎯)** tool to hover over DOM elements and inspect selectors live.

---

## 5. Stable Locator Guidelines for Master Record (`/master`)

To prevent brittle DOM selectors based on display text that might be renamed:

1. **Root Field Selector**:
   In `MasterFieldDisplay` (`src/components/client/data-schema-tab.tsx`), master field containers expose:
   * `data-testid="master-field-{fieldNo}"`
   * `data-field-no="{fieldNo}"`
   * `aria-label="Inspect field {fieldNo}: {label}"`

2. **Universal Robust Selector Helper**:
   ```typescript
   const getFieldRow = (fieldNo: number) =>
       page.locator(`[data-testid="master-field-${fieldNo}"]`)
           .or(page.locator(`[data-field-no="${fieldNo}"]`))
           .or(page.locator(`[aria-label^="Inspect field ${fieldNo}:"]`))
           .or(page.locator('div.group').filter({ hasText: new RegExp(`\\bField ${fieldNo}\\b`) }))
           .first();
   ```

3. **Avoid Ephemeral Toast Assertions**:
   Do not block tests on ephemeral toast notifications (`Team access configured...`) that automatically disappear after 3 seconds. Assert the durable modal dismissal instead:
   ```typescript
   // ✅ Durable, immune to timeout races during slow stepping / debugging
   await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 20000 });
   ```

---

## 6. How to Add a New Golden Entity Regression Test

1. **Select a Target Entity**: Identify an entity with rich public registry coverage (e.g. French SIREN, US Delaware corporation, or UK Investment Fund).
2. **Inspect Registry Data**: Use `fetchGLEIFData(lei)` or registry connectors to extract the raw candidate mappings.
3. **Create the Contract Spec** (`e2e/regression/<name>-contract.spec.ts`):
   * Add scoped baseline cleanup.
   * Record `testStartedAt`.
   * Call `LegalEntityEnrichmentService.bootstrapEntity(clientLEId)`.
   * Record `enrichmentCompletedAt`.
   * Assert field values, structured types, and claim freshness (`testStartedAt <= assertedAt <= enrichmentCompletedAt`).
4. **Create the UI Spec** (`e2e/regression/<name>-master-record.spec.ts`):
   * Exercise the creation modal via browser.
   * Configure permissions.
   * Navigate to `/master` and assert key anchor fields with `getFieldRow(fieldNo)`.
5. **Run TypeScript Check & Test Suite**:
   ```bash
   npx tsc --noEmit
   npx playwright test e2e/regression/<name>-*.spec.ts
   ```
