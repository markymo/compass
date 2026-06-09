# Graph-Backed Reference Fields

> **Status:** Current agreed architecture as of June 2026.  
> **Scope:** Master Data fields with `appDataType` of `PERSON_REF`, `ORG_REF`, `ADDRESS_REF`, or `PARTY_REF`.

---

## 1. Summary

Graph-backed reference fields are **live references into the Coparity knowledge graph**.

A field of type `PERSON_REF`, `ORG_REF`, `ADDRESS_REF`, or `PARTY_REF` does not copy
person / organisation / address data into the field. It stores a reference to the selected
graph node and resolves display values live from the knowledge graph at read time.

This keeps reference fields connected to canonical, up-to-date entity records. Corrections
and enrichments to `Person`, `LegalEntity`, or `Address` nodes automatically propagate to
any Master Data field that references them.

---

## 2. Storage Model

### 2.1 FieldClaim value slot

When a user selects a node for a reference field, a `FieldClaim` is written using the
appropriate typed FK column:

| `appDataType` | `FieldClaim` column written | Resolves via Prisma |
|---|---|---|
| `PERSON_REF` | `valuePersonId` | `valuePerson` (join to global `person` table) |
| `ORG_REF` | `valueLeId` | `valueLe` (join to global `legalEntity` table) |
| `ADDRESS_REF` | `valueAddressId` | `valueAddress` (join to global `address` table) |
| `PARTY_REF` | `valuePersonId` or `valueLeId` depending on the selected node type | same |

`FieldClaim.valueJson` is **not** used for graph-backed reference fields. See §3.

### 2.2 Graph edge write-back

In addition to the `FieldClaim`, selecting a node writes a `ClientLEGraphEdge`:

```
selected graph node  ──[writeBackEdgeType]──▶  Client LE root LEGAL_ENTITY node
```

**Example:**

```
Alan Bennett (PERSON node)  ──BENEFICIARY──▶  Lynn Wind Farm Ltd (LEGAL_ENTITY node)
```

The edge row must satisfy all of the following:

| Column | Required value |
|---|---|
| `fromNodeId` | `ClientLEGraphNode.id` for the selected person / org / address |
| `toNodeId` | `ClientLEGraphNode.id` of the **root** LEGAL_ENTITY node for the current Client LE |
| `edgeType` | `MasterFieldGraphBinding.writeBackEdgeType` |
| `clientLEId` | Current Client LE id |
| `isActive` | `MasterFieldGraphBinding.writeBackIsActive` (default: `true`) |
| `source` | `USER_INPUT` |

> **Invariant:** `toNodeId` must never be `null`. An edge with `toNodeId = null` is
> semantically invalid — it represents a relationship to an unknown entity.
> The `FieldClaimService.writeBackGraphEdge()` method resolves the root
> `LEGAL_ENTITY` graph node from `clientLE.legalEntityId` before writing.

### 2.3 Multi-value fields — graph-edge read path

For `isMultiValue = true` graph-bound fields, `getFieldDetail` sources rows
**from `ClientLEGraphEdge`**, not from `FieldClaim`:

```
ClientLEGraphEdge.findMany({
    where: { clientLEId, edgeType: graphBinding.filterEdgeType, isActive: true },
    include: { fromNode: { include: { person, legalEntity, address } } }
})
```

Each edge becomes a display row. `row.value` is the live entity object joined
from the global table. There is no snapshot in this path.

---

## 3. No Snapshots (Deliberate Decision)

> **We do not currently store point-in-time snapshots for graph-backed reference fields.**

Rationale:

- The knowledge graph is the source of truth for entity data.
- Corrections and enrichments to `Person`, `LegalEntity`, and `Address` nodes should
  flow through to all reference fields that point to them.
- The relationship **edge** captures the semantically important fact (e.g. "this person
  is a beneficiary of this LE").
- Keeping references live avoids maintaining divergent copies of entity data.
- Snapshot capability can be revisited for audit, export, and evidence requirements.

**Consequences of this decision:**

```
FieldClaim.valueJson      — not used for reference snapshots
ClientLEGraphEdge.snapshotJson  — does not exist; must not be added until snapshot
                                  architecture is explicitly designed and approved
```

If a person's name changes in the global `person` table, any `PERSON_REF` field
referencing them will immediately display the new name. This is intentional.

---

## 4. MasterFieldGraphBinding Configuration

Every graph-backed reference field requires a `MasterFieldGraphBinding` row.
This is created by an admin after the field definition is saved.

### 4.1 Column reference

| Column | Type | Meaning |
|---|---|---|
| `fieldNo` | Int | The `MasterFieldDefinition.fieldNo` this binding applies to |
| `graphNodeType` | String | Type of graph node the picker shows: `PERSON`, `LEGAL_ENTITY`, or `ADDRESS` |
| `filterEdgeType` | String? | Legacy edge hint. **Not used for picker sorting or filtering in the current implementation.** Retained for future candidate-scope configuration. Do not rely on this for ordering. |
| `filterActiveOnly` | Boolean | Legacy setting linked to `filterEdgeType`; not central to current picker behaviour |
| `writeBackEdgeType` | String? | The `edgeType` value written to `ClientLEGraphEdge` when a node is selected |
| `writeBackIsActive` | Boolean | Whether the written edge has `isActive = true` (default: `true`) |
| `pickerLabel` | String? | Optional UI label override for the picker button |
| `allowCreate` | Boolean | Whether the picker offers a "Create new" flow to add a node that doesn't exist yet |
| `isActive` | Boolean | Whether this binding is active (inactive bindings are ignored at runtime) |

### 4.2 Example configuration

```json
{
  "fieldNo": 126,
  "fieldName": "Named Beneficiaries",
  "appDataType": "PERSON_REF",
  "isMultiValue": true,
  "graphBinding": {
    "graphNodeType": "PERSON",
    "filterEdgeType": null,
    "writeBackEdgeType": "BENEFICIARY",
    "writeBackIsActive": true,
    "pickerLabel": "Select beneficiary",
    "allowCreate": true,
    "isActive": true
  }
}
```

> `filterEdgeType` is `null` in new configurations. The value `BENEFICIARY` appears only
> in `writeBackEdgeType`. These are two different concepts — see §8.

---

## 5. Picker Behaviour

```
The picker shows all known graph nodes of the configured graphNodeType
for the current Client LE.

Results are sorted alphabetically ascending by display label.

The picker does not filter or promote results by edge type.

Existing relationship badges (e.g. "DIRECTOR", "PSC") may be displayed on
picker rows as contextual information, but they do not affect sort order
or eligibility.
```

**Implementation note:** The promotion sort logic was removed in June 2026.
`GraphNodePickerItem.isPromoted` is always `false`. Do not re-introduce
`filterEdgeType`-based promotion without a deliberate design decision.

---

## 6. Write-Back Behaviour

When a user confirms a selection in the picker:

1. **FieldClaim is written** — the selected entity's ID is stored in the appropriate
   FK column (`valuePersonId`, `valueLeId`, or `valueAddressId`).

2. **Graph edge is upserted** — `FieldClaimService.writeBackGraphEdge()` finds or
   creates a `ClientLEGraphEdge` with:
   - `fromNodeId` = the selected graph node
   - `toNodeId` = the root LEGAL_ENTITY graph node for the current Client LE
   - `edgeType` = `binding.writeBackEdgeType`

3. **Idempotency** — if an edge with the same `(fromNodeId, edgeType)` already exists,
   it is updated rather than duplicated. The `@@unique([fromNodeId, toNodeId, edgeType])`
   constraint enforces this.

### 6.1 Removal behaviour

When a user removes a selection (multi-value), the current service emits a tombstone
`FieldClaim` (`valueJson: { tombstone: true }`). The corresponding graph edge is
deactivated (`isActive = false`). The display collection re-reads live edge state, so
deactivated edges are excluded.

---

## 7. Node Field Registry

The fields available on each graph node type are catalogued in a **code-level registry**:

```
src/lib/graph/node-field-registry.ts
```

This file defines:
- `NodeFieldDefinition` interface — metadata per field (label, dataType, scope, PII flag, etc.)
- `NODE_FIELD_REGISTRY` constant — all 23 system fields across PERSON (11), LEGAL_ENTITY (6), ADDRESS (6)
- Lookup helpers: `getNodeFields`, `getNodeField`, `getDisplayableFields`, `getSearchableFields`

### Current system fields

| Node Type | fieldKey | dataType | isSearchable | isPii |
|---|---|---|---|---|
| PERSON | title | TEXT | ❌ | ❌ |
| PERSON | firstName | TEXT | ✅ | ✅ |
| PERSON | middleName | TEXT | ❌ | ✅ |
| PERSON | lastName | TEXT | ✅ | ✅ |
| PERSON | dateOfBirth | DATE | ❌ | ✅ |
| PERSON | placeOfBirth | TEXT | ❌ | ✅ |
| PERSON | primaryNationality | COUNTRY_CODE | ✅ | ❌ |
| PERSON | countryOfResidence | COUNTRY_CODE | ✅ | ❌ |
| PERSON | officerRole | TEXT | ✅ | ❌ |
| PERSON | occupation | TEXT | ❌ | ❌ |
| PERSON | isPublicFigure | BOOLEAN | ❌ | ❌ |
| LEGAL_ENTITY | name | TEXT | ✅ | ❌ |
| LEGAL_ENTITY | localRegistrationNumber | TEXT | ✅ | ❌ |
| LEGAL_ENTITY | jurisdiction | TEXT | ✅ | ❌ |
| LEGAL_ENTITY | legalForm | TEXT | ❌ | ❌ |
| LEGAL_ENTITY | entityStatus | TEXT | ❌ | ❌ |
| LEGAL_ENTITY | countryOfIncorporation | COUNTRY_CODE | ✅ | ❌ |
| ADDRESS | line1 | TEXT | ✅ | ❌ |
| ADDRESS | line2 | TEXT | ❌ | ❌ |
| ADDRESS | city | TEXT | ✅ | ❌ |
| ADDRESS | region | TEXT | ❌ | ❌ |
| ADDRESS | postalCode | TEXT | ❌ | ❌ |
| ADDRESS | country | COUNTRY_CODE | ✅ | ❌ |

### Design note: `Person.officerRole` — MVP denormalisation

`officerRole` is stored as a free-text `String?` on the `Person` model, preserving the raw
value from Companies House (e.g. `"director"`, `"secretary"`, `"llp-member"`).

This is an intentional MVP pragmatism:
- CH provides the role alongside person identity in the same officer payload.
- Storing it on `Person` avoids losing the information on ingest.
- The role relationship (person is a director of company X) is separately modelled as a
  `ClientLEGraphEdge` with `edgeType = DIRECTOR`.

**Future migration path:** `Person.officerRole` may eventually move to an edge attribute
(`ClientLEGraphEdge.officerRole String?`) when edge-level role semantics are needed for
querying or filtering. Until then, the field provides read-access to the source value
without requiring an edge traversal.

### Invariants

- All system fields have `storageKind = SYSTEM_COLUMN`, `scope = GLOBAL`, `isSystem = true`.
- `storagePath` must start with the entity prefix: `person.` / `legalEntity.` / `address.`
- `fieldKey` must be unique within each `nodeType`.
- These invariants are enforced by unit tests in `src/lib/graph/__tests__/node-field-registry.test.ts`.

### Admin-created custom node fields

**Custom node fields are not implemented.** The registry is read-only and code-managed.
Adding a new system field requires a Prisma schema migration and a PR updating the registry.

When custom fields are needed, the plan is:
1. Add `customProperties: Json?` to `ClientLEGraphNode` for simple LE-scoped values.
2. Add a `NodeFieldValue` table for typed, queryable global or LE-scoped values.
3. Custom field definitions will be stored in the DB and merged with `NODE_FIELD_REGISTRY` at runtime.

### pickerConfig (Phase 3 — stored and consumed for display labels)

`pickerConfig` was added in June 2026 as a nullable JSON column on `MasterFieldGraphBinding`.
As of Phase 3, it is consumed by `getGraphNodesForPicker` to build `displayLabel` and `subLabel`
from `rawFields` when present.

#### Column

```prisma
pickerConfig Json?  // on MasterFieldGraphBinding
```

#### Shape

```ts
type GraphPickerConfig = {
  displayFields?:     string[];  // fieldKeys for primary display label
  subFields?:         string[];  // fieldKeys for sub-label
  searchFields?:      string[];  // fieldKeys included in search (Phase 4)
  pickerPlaceholder?: string;    // override for picker button text
};
```

#### Validation rules (enforced server-side by `sanitizePickerConfig`)

- Non-object input → stored as `null`
- `displayFields` and `subFields` — only `isDisplayable` fieldKeys for the binding's `graphNodeType`
- `searchFields` — only `isSearchable` fieldKeys for the binding's `graphNodeType`
- Unknown fieldKeys → silently removed (sanitize-not-reject)
- Empty arrays → omitted from the stored object
- Empty string placeholder → omitted
- Resulting empty config → stored as `null`

**Null means legacy/default picker behaviour** — `displayLabel` and `subLabel` remain
hardcoded by node type. `null` and an absent config are identical at runtime.

#### Phase 3 display behaviour

When a valid `pickerConfig` is passed to `getGraphNodesForPicker`:

1. `sanitizePickerConfig()` validates the config server-side.
2. If `displayFields` is set, values are read from `rawFields` via `formatRawFieldValue()` and joined with ` · `.
3. If `subFields` is set, values are joined the same way.
4. **Fallback**: if configured display resolves to an empty string (all fields null), the legacy hardcoded label is used. This prevents blank rows from bad config.

`formatRawFieldValue()` rules:

| dataType | Output |
|---|---|
| TEXT / COUNTRY_CODE | String as-is (trimmed); objects → null |
| DATE | `YYYY-MM-DD` (locale-independent) |
| BOOLEAN | `"Yes"` / `"No"` |
| NUMBER | `String(value)` |
| null / undefined / empty | omitted |

#### searchFields — consumed by client-side picker search (Phase 4)

`searchFields` is validated, stored, and consumed by both picker components.

When `pickerConfig.searchFields` is set, the client-side search logic searches:

1. **Legacy corpus** (always searched, regardless of config):
   - `displayLabel`
   - `subLabel`
   - `activeEdgeTypes`

2. **Configured rawFields** (when searchFields is present):
   - `rawFields[fieldKey]` for each `fieldKey` in validated `searchFields`
   - Values formatted via `formatRawFieldValue()` and lowercased before comparison
   - Null/empty formatted values are skipped (not searched)

Only `isSearchable = true` fields from `NODE_FIELD_REGISTRY` survive `sanitizePickerConfig()`.
Non-searchable fields (e.g. `occupation`, `postalCode`, `dateOfBirth`) are automatically excluded.

**Shared helper location:**
```
src/lib/graph/field-value-formatting.ts
```

Exports:
- `formatRawFieldValue(value, dataType)` — type-aware value formatter
- `itemMatchesSearch(item, query, pickerConfig?)` — full search matcher
- `PickerItemSearchable` — minimal structural interface

Both `graph-node-picker.tsx` and `graph-node-picker-dialog.tsx` import `itemMatchesSearch` from here.
`graph-node-picker.ts` (server action) also imports `formatRawFieldValue` from here.

#### Admin UI — fully configurable (Phase 5)

`pickerConfig` is now fully configurable through the existing **Graph Node Binding** dialog in
the Field Detail Sheet. Admins no longer need to edit JSON directly.

**Location:** `Admin → Master Data → [field] → Graph Node Binding → Add Binding → Picker Configuration`

**UI sections:**

| Section | UI | Registry source |
|---|---|---|
| Display Fields | Checkbox list | `getDisplayableFields(nodeType)` |
| Secondary Fields | Checkbox list | `getDisplayableFields(nodeType)` |
| Search Fields | Checkbox list | `getSearchableFields(nodeType)` — non-searchable fields hidden |
| Picker Placeholder | Text input | free text |

All field labels and keys come from `NODE_FIELD_REGISTRY`, sorted by `order ASC`.
The list automatically changes when the **Graph Node Type** selector changes.

**Save flow:**
1. UI builds a partial `GraphPickerConfig` object from checked fields.
2. Empty arrays / blank placeholder → `null` is passed (no config stored).
3. `upsertGraphBinding()` calls `sanitizePickerConfig()` server-side before DB write.
4. Existing bindings with `pickerConfig` show a `configured` badge in the binding list row.

#### Validation helper

```
src/lib/graph/picker-config.ts
```

Exports:
- `GraphPickerConfig` interface
- `sanitizePickerConfig(nodeType, input)` → validated config or null
- `isEmptyPickerConfig(config)` → boolean

The `upsertGraphBinding` server action calls `sanitizePickerConfig` before every DB write.

### GraphNodePickerItem.rawFields

Introduced in Phase 1 (June 2026) as infrastructure for future pickerConfig.

`rawFields` is a flat `Record<string, unknown>` on every `GraphNodePickerItem`,
keyed by `fieldKey` from `NODE_FIELD_REGISTRY`:

```ts
{
  displayLabel: "Alan Bennett",
  subLabel: "British",
  // ... other existing fields ...
  rawFields: {
    firstName: "Alan",
    lastName: "Bennett",
    middleName: null,
    dateOfBirth: Date("1952-04-30"),
    placeOfBirth: "Armley",
    primaryNationality: "British",
    isPublicFigure: false,
  }
}
```

- Populated by `buildRawFields()` in `graph-node-picker.ts` using registry `storagePath`s.
- The Prisma `select` is now built from the registry (`buildEntitySelect()`), so widening
  the registry automatically widens the DB fetch.
- **Not currently consumed by the picker UI** — `displayLabel`/`subLabel` are still
  hardcoded and drive the current display. rawFields is invisible to users.
- Phase 2 will use `rawFields` as the data source when pickerConfig-driven display is
  implemented.
- Missing fields always resolve to `null`, never `undefined`.

---

## 8. Deferred / Not Implemented Yet

The following are deliberately **not implemented** in the current architecture.
Do not implement any of these without an explicit design decision:

- **pickerConfig on MasterFieldGraphBinding** — admin-configurable display/search fields
  for the picker. Registry (§7) is the prerequisite; pickerConfig selects from registry fieldKeys.

- **Snapshot-on-selection** — storing a point-in-time copy of entity fields at the
  moment of selection.

- **Custom node fields** — admin-created fields extending PERSON/LEGAL_ENTITY/ADDRESS
  beyond the current system columns.

- **Candidate scopes beyond the current Client LE** — e.g. searching globally
  across all known persons, or searching by prior role in a related entity.

- **Edge-type filtering or promotion in the picker** — restricting the picker
  to nodes that already have a specific edge type, or sorting them to the top.

- **Global person search** — cross-LE or cross-engagement entity lookup.

The anticipated future pickerConfig shape is documented in §7 above as a design note
only. `pickerConfig` does not exist in the current `MasterFieldGraphBinding` schema.

---

## 9. Invariants and Warnings

> These rules must be followed by all code that reads or writes graph-backed reference fields.

| # | Invariant |
|---|---|
| 1 | **Never hardcode `fieldNo` to enable graph-backed behaviour.** Bindings are admin-configured; the field number must be resolved at runtime from `MasterFieldGraphBinding`. |
| 2 | **Never write a `ClientLEGraphEdge` with `toNodeId = null`.** Always resolve the root LEGAL_ENTITY graph node for `clientLEId` before writing. A null `toNodeId` makes the edge semantically invalid and causes "Unknown Node" display in the UI. |
| 3 | **Do not treat `filterEdgeType` as the write-back edge type.** `filterEdgeType` is a legacy presentation hint. The edge type to write is always `writeBackEdgeType`. These may differ. |
| 4 | **Do not copy node data into `FieldClaim.valueJson` unless the snapshot architecture is explicitly approved.** Storing entity fields in `valueJson` creates divergent copies that are difficult to reconcile with graph enrichment. |
| 5 | **Do not read `FieldClaim` rows as the source of truth for multi-value graph-bound fields.** The authoritative source is `ClientLEGraphEdge` (via the graph-binding read path in `getFieldDetail`). |
| 6 | **Do not add fields to `NODE_FIELD_REGISTRY` without a matching Prisma column.** SYSTEM_COLUMN fields must have a real column; adding a phantom field causes silent null values at runtime. |

---

## 10. Related Files

| File | Role |
|---|---|
| `src/lib/graph/node-field-registry.ts` | **Node Field Registry** — all system field definitions and lookup helpers (23 fields) |
| `src/lib/graph/__tests__/node-field-registry.test.ts` | Tests covering registry integrity, helpers, field catalogues |
| `src/lib/kyc/FieldClaimService.ts` | `writeBackGraphEdge()` — writes FK claim and graph edge on selection |
| `src/actions/graph-node-picker.ts` | Server action — fetches picker items, builds `rawFields` from registry (Phase 1), alphabetical sort |
| `src/components/client/graph/graph-node-picker.tsx` | Popover picker UI component |
| `src/components/client/graph/graph-node-picker-dialog.tsx` | Dialog picker UI component |
| `src/components/client/inspection/field-detail-panel.tsx` | Renders reference field rows; `renderRowValue()` resolves display from live entity object |
| `src/actions/kyc-query.ts` | `getFieldDetail()` — graph-binding read path (lines ~548–592) |
| `src/lib/kyc/KycStateService.ts` | `mapToDerivedValue()` — claim-based value resolution |
| `scripts/backfill-graph-edge-toNodeId.ts` | One-time backfill for null-toNodeId edges written before the June 2026 fix |
