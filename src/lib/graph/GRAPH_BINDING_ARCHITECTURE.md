# Graph Node Binding — Architecture Reference

## Overview

`MasterFieldGraphBinding` links a Master Data Field to the Knowledge Graph, allowing the field's value to be selected from (and optionally written back to) graph nodes (Person, Legal Entity, Address).

The binding stores two distinct layers of configuration in a single `pickerConfig Json?` column:

---

## 1. Picker Configuration (Selection UX)

Controls **how users choose a node** in the picker UI.

```ts
pickerConfig.displayFields     // field keys shown as the primary picker row label
pickerConfig.subFields         // field keys shown beneath the primary label
pickerConfig.searchFields      // additional fields matched during text search
pickerConfig.pickerPlaceholder // override text for the search input
```

All keys are validated against `NODE_FIELD_REGISTRY` for the binding's `graphNodeType`.  
Unknown keys are silently stripped at save time.  
Empty config is stored as `null`.

### Legacy / unconfigured behaviour

When `pickerConfig` is `null`:
- Display label: `firstName + lastName` (PERSON) / `name` (LEGAL_ENTITY) / `line1` (ADDRESS)
- Sub-label: `primaryNationality` (PERSON) / `jurisdiction` (LEGAL_ENTITY) / `postalCode + country` (ADDRESS)
- Search: matches `displayLabel`, `subLabel`, and `activeEdgeTypes`

---

## 2. Projection Fields (Downstream Governance)

Controls **what data from the selected node is exposed** to downstream consumers (display panels, questionnaire matchers, export).

```ts
pickerConfig.projectionFields  // subset of node fields this field is allowed to reveal
```

### Semantics

- **Empty / absent** (current default): No restriction. All node fields visible downstream — identical to pre-Phase-5.3 behaviour.
- **Populated**: Declares intent that only the listed fields should be exposed. Runtime enforcement is **Phase 5.4** (not yet implemented).

### Rationale

A node may contain sensitive fields (e.g. `dateOfBirth`, `pepFlag`, `passportScan`) that should not surface for a general-purpose reference like "General Contact". A KYC-specific field like "Named Director" may legitimately expose more. Projection provides field-level governance without needing a permissions system or data duplication.

### Example

```json
{
  "displayFields": ["firstName", "lastName"],
  "subFields": ["officerRole"],
  "searchFields": ["firstName", "lastName", "officerRole"],
  "projectionFields": ["firstName", "lastName", "officerRole", "primaryNationality"]
}
```

---

## 3. Reference Storage Model

> **No snapshots. No field copying.**

When a node is selected:
1. The field stores only the node ID (`valuePersonId`, `valueLeId`, `valueAddressId` in `FieldClaim`).
2. The node record itself is the single source of truth.
3. Display values are resolved at read time from the live graph.

This means:
- Node edits propagate immediately to all fields that reference that node.
- There is no risk of stale snapshot data.
- Projection controls what is **exposed**, not what is **stored**.

---

## 4. Validation Rules (`sanitizePickerConfig`)

| Field | Allowed values | Empty behaviour |
|---|---|---|
| `displayFields` | `isDisplayable` keys for nodeType | omitted if empty |
| `subFields` | `isDisplayable` keys for nodeType | omitted if empty |
| `projectionFields` | `isDisplayable` keys for nodeType | omitted if empty |
| `searchFields` | `isSearchable` keys for nodeType | omitted if empty |
| `pickerPlaceholder` | any non-empty string | omitted if blank |
| (entire config) | — | stored as `null` if all keys absent |

Non-object input (string, number, array, null) → stored as `null`.

---

## 5. Phase Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | `NODE_FIELD_REGISTRY` — code-defined node field schema | ✅ Complete |
| 1 | `rawFields` in `GraphNodePickerItem` | ✅ Complete |
| 2 | `pickerConfig` storage + validation | ✅ Complete |
| 3 | `displayFields` / `subFields` consumed by picker | ✅ Complete |
| 4 | `searchFields` consumed by picker search | ✅ Complete |
| 5 | Admin UI for pickerConfig | ✅ Complete |
| 5.1 | `pickerConfig` wired from field-detail-panel to live picker | ✅ Complete |
| 5.2 | Edit existing binding (modal pre-population + update) | ✅ Complete |
| 5.3 | `projectionFields` — storage + admin UI + validation | ✅ Complete |
| **5.4** | **`projectionFields` runtime enforcement** | ⏳ Future |
| 6 | Graph node create/edit UI parity | ✅ Complete |

---

## 6. File Map

| File | Role |
|---|---|
| `src/lib/graph/node-field-registry.ts` | Registry of all node fields; source of truth for valid field keys |
| `src/lib/graph/picker-config.ts` | `GraphPickerConfig` type + `sanitizePickerConfig()` + `isEmptyPickerConfig()` |
| `src/lib/graph/binding-form-helpers.ts` | Pure helpers: `bindingToBindingForm`, `bindingFormToPickerConfig`, `BLANK_BINDING_FORM` |
| `src/actions/graph-bindings.ts` | `upsertGraphBinding` — create/update + sanitization |
| `src/actions/graph-node-picker.ts` | `getGraphNodesForPicker` — server action applying pickerConfig |
| `src/components/client/graph/graph-node-picker.tsx` | Picker component (consumnes displayFields, searchFields) |
| `src/components/client/graph/graph-node-picker-dialog.tsx` | Dialog picker variant |
| `src/components/client/admin/field-detail-sheet.tsx` | Admin UI — binding CRUD modal |
| `src/components/client/inspection/field-detail-panel.tsx` | Master Data panel — passes active binding pickerConfig to pickers |
