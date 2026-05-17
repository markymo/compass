# Source Mappings Page — Audit & Fix Plan
**Date:** 16 May 2026  
**Author:** Antigravity / Mark  
**Status:** Awaiting Implementation

---

## Context

The admin section has two pages that are "different sides of the same coin":

| Page | Route | Purpose |
|---|---|---|
| **Master Data Manager** | `/app/admin/master-data/manager` | Defines *what* the master fields are (`MasterFieldDefinition`) |
| **Source Field Mappings** | `/app/admin/master-data/source-mappings` | Defines *where* each field's value comes from (`SourceFieldMapping`) |

Each `SourceFieldMapping` row links a `sourcePath` (a dot-notation path into a raw API payload, e.g. `entity.legalName.name`) to a `targetFieldNo` (a `MasterFieldDefinition`). The Manager page shows a `SourceChip` for each mapping a field has; clicking it opens the field-detail sheet where mappings can be managed from the field-first perspective. The source-mappings page is the inverse — the mapping-first view, grouped by source type.

---

## Files Involved

| File | Role |
|---|---|
| `src/app/(platform)/app/admin/master-data/source-mappings/page.tsx` | Main page (1142 lines, pure `"use client"`) |
| `src/app/(platform)/app/admin/master-data/manager/page.tsx` | Manager page (Server Component, 74 lines) |
| `src/components/client/admin/master-data-manager.tsx` | Manager UI component (1054 lines) |
| `src/components/client/admin/source-mappings/data-inspector-panel.tsx` | Live JSON inspector (387 lines) |
| `src/actions/source-mappings.ts` | All server actions for mappings (669 lines) |

---

## 🔴 Critical Bugs

### Bug 1 — `RegistryNormalizationInspector` is dead code

**Location:** `source-mappings/page.tsx`, lines 845–959  
**Severity:** High — the entire "Registry Deep Discovery" section at the bottom of the page does nothing useful.

The `RegistryNormalizationInspector` component fetches a live registry record into `result` state, then renders two side-by-side `DataInspectorPanel` components labelled "Step 1: Raw API Payload" and "Step 2: Normalized Super Schema". However, `DataInspectorPanel` has no `initialPayload` prop — it always starts with an empty state. The fetched `result` is stored in state but **never passed to either panel**. Both panels will just display the blank "Search to explore live API schema" empty state.

```tsx
// ❌ Current — result fetched but ignored
const res = await fetchLiveRegistryRecord(query);
setResult(res.payload);  // stored in state
// ...
<DataInspectorPanel sourceType="REGISTRATION_AUTHORITY" ... />  // no payload passed
<DataInspectorPanel sourceType="REGISTRATION_AUTHORITY" ... />  // no payload passed
```

**Fix Options (pick one):**

*Option A (simpler):* Replace the two dead `DataInspectorPanel` instances with a direct render of the fetched data:
- Left panel: `<pre>` JSON dump of `result` (raw payload)
- Right panel: render a normalised summary from the known Super Schema keys

*Option B (proper):* Add an `initialPayload?: any` prop to `DataInspectorPanel` and pass `result` in. The component's `handleSearch` would be skipped if `initialPayload` is provided.

---

### Bug 2 — `revalidatePath` targets a non-existent route

**Location:** `actions/source-mappings.ts`, lines 247–248 and 336–337  
**Severity:** Medium — cached page data is never cleared after mutations.

```ts
// ❌ Wrong — "/mappings" route does not exist
revalidatePath("/app/admin/master-data/manager");
revalidatePath("/app/admin/master-data/mappings");
```

The correct route for the source-mappings page is `/app/admin/master-data/source-mappings`. As a result, Next.js never invalidates the cached page after a create, update, delete, or toggle operation.

**Fix:**
```ts
// ✅ Correct
revalidatePath("/app/admin/master-data/manager");
revalidatePath("/app/admin/master-data/source-mappings");
```

This change applies in **three places**: `upsertSourceMapping` (line 247), `deleteSourceMapping` (line 336), and optionally `toggleSourceMapping` (currently has no revalidation at all).

---

### Bug 3 — `sourceReference` never captured or passed through the UI

**Location:** `source-mappings/page.tsx` throughout; `actions/source-mappings.ts` lines 13–25  
**Severity:** High — jurisdiction-scoped RA mappings are structurally broken.

The backend has full support for `sourceReference` — the RA authority code (e.g. `RA000585` for UK Companies House, `RA000192` for French RNE). The `UpsertMappingInput` interface includes it:

```ts
interface UpsertMappingInput {
    sourceReference?: string | null; // RA scope identifier
    ...
}
```

`DataInspectorPanel` also accepts and uses it correctly to filter the "Mapped" highlights:
```ts
// data-inspector-panel.tsx lines 43–51
const activePaths = new Set(
    existingMappings
        .filter(m =>
            m.sourceType === sourceType &&
            (m.sourceReference ?? null) === (sourceReference ?? null)  // ← correct
        )
        .map(m => m.sourcePath)
);
```

But the source-mappings page **never**:
1. Captures `sourceReference` as a state variable
2. Shows a UI control to select which RA authority is in scope
3. Passes `sourceReference` to `DataInspectorPanel`
4. Includes it in the `MappingFormDialog` save payload

**Consequences:**
- All `REGISTRATION_AUTHORITY` mappings are created with `sourceReference: null`
- The "Mapped" indicator in the inspector is wrong — it will show all RA mappings regardless of authority
- There is no way via the UI to create a French (`RA000192`) mapping vs a UK (`RA000585`) mapping — they all get lumped together

**Fix:** When `sourceType === "REGISTRATION_AUTHORITY"`, show a second selector for the authority code. This could be driven from a `getAvailableAuthorities()` action querying distinct `sourceReference` values from existing mappings, or a static list of known RA codes derived from `RegistryEnrichmentService`.

---

## 🟡 Inconsistencies vs the Manager

### Issue 4 — Source type selector is hardcoded

**Location:** `source-mappings/page.tsx`, lines 282–290

```tsx
<SelectContent>
    <SelectItem value="GLEIF">GLEIF</SelectItem>
    <SelectItem value="REGISTRATION_AUTHORITY">Registration Authority (Super Schema)</SelectItem>
</SelectContent>
```

The Manager's `SOURCE_CONFIG` already lists additional source types (`USER_INPUT`, `AI_EXTRACTION`, `SYSTEM_DERIVED`). If new source types are added to the `SourceType` enum, the selector won't show them.

**Fix:** Drive the list from a `getDistinctSourceTypes()` server action, or at minimum add the missing enum values as `SelectItem` entries.

---

### Issue 5 — No shared `SourceChip` component

The Manager component has a well-built `SourceChip` with logos and colour coding per source type (lines 659–713 of `master-data-manager.tsx`). The source-mappings page renders source types as plain text `Badge` elements with no visual differentiation. These should share the same component.

**Fix:** Extract `SourceChip` and `SOURCE_CONFIG` from `master-data-manager.tsx` into a shared file (e.g. `src/components/client/admin/source-chip.tsx`) and import it in both places.

---

### Issue 6 — Architecture mismatch: Client-only vs Server Component

The Manager page is a Server Component that pre-fetches all data and passes serialised props to the client component. This gives:
- Instant first render (no loading flash)
- ISR / `revalidatePath` works correctly
- No waterfalling `useEffect` fetches

The source-mappings page is a pure `"use client"` component that fetches everything in `useEffect`. Every page visit shows a loading spinner, and `revalidatePath` has no effect since the page isn't cached by Next.js as a Server Component.

**Fix (lower priority):** Wrap in a Server Component that pre-fetches `getSourceMappings`, `getAvailableSourcePaths`, and `getActiveFieldDefinitions`, then passes them as `initialMappings`, `initialPaths`, and `fieldDefs` props — matching the Manager pattern.

---

### Issue 7 — Divergent field validation rules

`getActiveFieldDefinitions()` in `source-mappings.ts` (line 62) filters `where: { isActive: true }`. This prevents the `TargetFieldPicker` from targeting inactive fields.

The Manager's field-detail sheet fetches via `rawFields` with no `isActive` filter, so an admin can add a source mapping to an inactive field from the Manager side but not from the source-mappings side.

**Fix:** Either apply consistent filtering in both places, or add a clear warning in the field-detail sheet when adding a mapping to an inactive field.

---

## 🟢 UX Improvements

### Improvement 8 — Replace `confirm()` with `AlertDialog`

**Location:** `source-mappings/page.tsx`, line 233

```ts
if (!confirm("Are you sure you want to delete this mapping?")) return;
```

Native `confirm()` is blocking, unstyled, and inconsistent with every other destructive action in the codebase (which use shadcn `AlertDialog`).

**Fix:** Replace with a shadcn `AlertDialog` confirmation before calling `handleDelete`.

---

### Improvement 9 — Clarify row click vs edit button intent

Clicking a row calls `handlePreview(m)` (opens the preview panel). Clicking the `ChevronRight` button sets `editMapping` (opens the edit dialog). These two interactions are visually ambiguous — the edit button has no `title` tooltip and the row has no visual affordance indicating it's clickable for preview.

**Fix:** 
- Add `title="Edit mapping"` to the `ChevronRight` button
- Add a distinct `Eye` icon button for "Preview" so both actions are explicit

---

### Improvement 10 — Add "Jump to Manager" link from mapping row

When inspecting a mapping, there's no way to navigate to the corresponding field definition in the Manager to see graph bindings, option sets, or full metadata.

**Fix:** Add a small `ExternalLink` icon button in the actions column that navigates to `/app/admin/master-data/manager` with a `?field=F{n}` query param (requires the Manager to support deep-linking to a specific field — a small enhancement itself).

---

## Implementation Priority

| # | Issue | Priority | Effort |
|---|---|---|---|
| Bug 1 | `RegistryNormalizationInspector` dead panels | 🔴 High | Medium |
| Bug 2 | `revalidatePath` wrong route | 🔴 High | Trivial |
| Bug 3 | `sourceReference` missing from UI | 🔴 High | Medium-High |
| Issue 4 | Hardcoded source selector | 🟡 Medium | Small |
| Issue 5 | No shared `SourceChip` | 🟡 Medium | Small |
| Issue 6 | Architecture drift (client-only) | 🟡 Medium | Medium |
| Issue 7 | Divergent field validation | 🟡 Medium | Small |
| Improvement 8 | `confirm()` → `AlertDialog` | 🟢 Low | Small |
| Improvement 9 | Row/edit ambiguity | 🟢 Low | Trivial |
| Improvement 10 | Jump-to-Manager link | 🟢 Low | Small |

---

## Quick Wins (do immediately)

These are safe, isolated changes that can be made in minutes:

1. **Fix `revalidatePath`** — two-line change in `actions/source-mappings.ts`
2. **Add `title` to edit button** — one-line change in `source-mappings/page.tsx`
3. **Add `toggleSourceMapping` revalidation** — currently has zero `revalidatePath` calls

---

*End of document. Pick up with Bug 2 (trivial) → Bug 3 (sourceReference) → Bug 1 (dead panels) as the recommended sequence.*
