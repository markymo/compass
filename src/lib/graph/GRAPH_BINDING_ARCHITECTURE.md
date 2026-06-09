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
Empty picker UX config with no explicit governance choice → stored as `null`.

### Legacy / unconfigured behaviour

When `pickerConfig` is `null`:
- Display label: `firstName + lastName` (PERSON) / `name` (LEGAL_ENTITY) / `line1` (ADDRESS)
- Sub-label: `primaryNationality` (PERSON) / `jurisdiction` (LEGAL_ENTITY) / `postalCode + country` (ADDRESS)
- Search: matches `displayLabel`, `subLabel`, and `activeEdgeTypes`

---

## 2. Projection Fields (Downstream Governance)

Controls **what data from the selected node is exposed** to downstream consumers.

### Projection Modes

```ts
projectionMode: "DEFAULT" | "CUSTOM" | "NONE"
```

| Mode | Meaning | projectionFields |
|---|---|---|
| `DEFAULT` | System-safe defaults (see below) | Ignored — defaults used |
| `CUSTOM` | Admin-specified field list | Required; `[]` = expose nothing |
| `NONE` | Expose nothing | Not stored |

### System-safe defaults (`DEFAULT`)

```
PERSON:        firstName, lastName
LEGAL_ENTITY:  name
ADDRESS:       line1, postalCode
```

These are deliberately minimal — enough to identify the node, not enough to expose sensitive data.

### Fail-safe behaviour

```
pickerConfig absent (null)        → resolves as DEFAULT
projectionMode absent             → resolves as DEFAULT
invalid projectionMode value      → resolves as DEFAULT (safe fallback)
```

**Projection fails safe** — an admin must make an explicit CUSTOM or NONE choice to change the default.

### The key distinction

```
displayFields / subFields / searchFields  →  Picker UX (node selection)
projectionMode / projectionFields         →  Downstream data governance
```

Do not confuse them. A rich `displayFields` config to help users choose the right node does **not** mean those fields are exposed downstream.

### Storage rules

- `projectionMode DEFAULT` alone → stored as `null` (implicit — no explicit choice)
- `projectionMode CUSTOM` → always stored, even with `projectionFields: []`
- `projectionMode NONE` → always stored (explicit suppression choice)

### Example full config

```json
{
  "displayFields": ["firstName", "lastName"],
  "subFields": ["officerRole"],
  "searchFields": ["firstName", "lastName", "officerRole"],
  "projectionMode": "CUSTOM",
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
4. Projection controls what is **exposed**, not what is **stored**.

---

## 4. Validation Rules (`sanitizePickerConfig`)

| Field | Allowed values | Notes |
|---|---|---|
| `displayFields` | `isDisplayable` keys for nodeType | Empty → omitted |
| `subFields` | `isDisplayable` keys for nodeType | Empty → omitted |
| `searchFields` | `isSearchable` keys for nodeType | Empty → omitted |
| `pickerPlaceholder` | non-empty string | Trimmed; empty → omitted |
| `projectionMode` | `"DEFAULT" \| "CUSTOM" \| "NONE"` | Invalid → omitted (resolver defaults) |
| `projectionFields` | `isDisplayable` keys for nodeType, **only when CUSTOM** | Empty `[]` kept for CUSTOM |
| (entire config) | — | `null` if nothing meaningful |

`isEmptyPickerConfig` treats `CUSTOM` and `NONE` as meaningful content — they represent explicit admin decisions and are never elided.

---

## 5. Runtime Helpers

```ts
// Safe defaults for a node type
getDefaultProjectionFields("PERSON")        // ["firstName", "lastName"]
getDefaultProjectionFields("LEGAL_ENTITY")  // ["name"]
getDefaultProjectionFields("ADDRESS")       // ["line1", "postalCode"]

// Resolve effective projection (fail-safe)
resolveProjectionFields(nodeType, pickerConfig)
// null/undefined → defaults
// DEFAULT        → defaults
// NONE           → []
// CUSTOM         → projectionFields ?? []
```

---

## 6. Phase Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | `NODE_FIELD_REGISTRY` | ✅ Complete |
| 1 | `rawFields` in `GraphNodePickerItem` | ✅ Complete |
| 2 | `pickerConfig` storage + validation | ✅ Complete |
| 3 | `displayFields` / `subFields` consumed by picker | ✅ Complete |
| 4 | `searchFields` consumed by picker search | ✅ Complete |
| 5 | Admin UI for pickerConfig | ✅ Complete |
| 5.1 | `pickerConfig` wired from field-detail-panel to live picker | ✅ Complete |
| 5.2 | Edit existing binding (modal pre-population + update) | ✅ Complete |
| 5.3 | `projectionFields` — storage + admin UI + validation | ✅ Complete |
| 5.3b | `projectionMode` — DEFAULT/CUSTOM/NONE with fail-safe semantics | ✅ Complete |
| **5.4** | **`projectionFields` runtime enforcement** | ⏳ Future |
| 6 | Graph node create/edit UI parity | ✅ Complete |

---

## 7. File Map

| File | Role |
|---|---|
| `src/lib/graph/node-field-registry.ts` | Registry of all node fields; source of truth for valid field keys |
| `src/lib/graph/picker-config.ts` | `GraphPickerConfig` type, `ProjectionMode`, `getDefaultProjectionFields`, `resolveProjectionFields`, `sanitizePickerConfig`, `isEmptyPickerConfig` |
| `src/lib/graph/binding-form-helpers.ts` | Pure helpers: `bindingToBindingForm`, `bindingFormToPickerConfig`, `BLANK_BINDING_FORM` |
| `src/actions/graph-bindings.ts` | `upsertGraphBinding` — create/update + sanitization |
| `src/actions/graph-node-picker.ts` | `getGraphNodesForPicker` — server action applying pickerConfig |
| `src/components/client/graph/graph-node-picker.tsx` | Picker component (displayFields, searchFields) |
| `src/components/client/graph/graph-node-picker-dialog.tsx` | Dialog picker variant |
| `src/components/client/admin/field-detail-sheet.tsx` | Admin UI — binding CRUD modal incl. projection mode selector |
| `src/components/client/inspection/field-detail-panel.tsx` | Master Data panel — passes active binding pickerConfig to pickers |
