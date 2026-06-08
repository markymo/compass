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
| `filterEdgeType` | String? | Legacy/presentation hint only. **Not used for picker sorting or filtering in the current implementation.** Retained for future candidate-scope configuration |
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

## 7. Deferred / Not Implemented Yet

The following are deliberately **not implemented** in the current architecture.
Do not implement any of these without an explicit design decision:

- **Snapshot-on-selection** — storing a point-in-time copy of entity fields at the
  moment of selection.

- **Admin-configurable returned fields** — controlling which fields from the selected
  entity appear in the field display.

- **Admin-configurable picker display fields** — e.g. showing date of birth or
  nationality alongside name in the picker list.

- **Candidate scopes beyond the current Client LE** — e.g. searching globally
  across all known persons, or searching by prior role in a related entity.

- **Edge-type filtering or promotion in the picker** — restricting the picker
  to nodes that already have a specific edge type, or sorting them to the top.

- **Global person search** — cross-LE or cross-engagement entity lookup.

The anticipated future configuration shape for returned/snapshot fields is noted
here for reference only. It does **not** reflect current behaviour:

```json
{
  "displayFields": ["firstName", "lastName", "dateOfBirth", "nationality"],
  "searchFields": ["firstName", "lastName"],
  "snapshotFields": []
}
```

These fields do not exist in the current `MasterFieldGraphBinding` schema.

---

## 8. Invariants and Warnings

> These rules must be followed by all code that reads or writes graph-backed reference fields.

| # | Invariant |
|---|---|
| 1 | **Never hardcode `fieldNo` to enable graph-backed behaviour.** Bindings are admin-configured; the field number must be resolved at runtime from `MasterFieldGraphBinding`. |
| 2 | **Never write a `ClientLEGraphEdge` with `toNodeId = null`.** Always resolve the root LEGAL_ENTITY graph node for `clientLEId` before writing. A null `toNodeId` makes the edge semantically invalid and causes "Unknown Node" display in the UI. |
| 3 | **Do not treat `filterEdgeType` as the write-back edge type.** `filterEdgeType` is a legacy presentation hint. The edge type to write is always `writeBackEdgeType`. These may differ. |
| 4 | **Do not copy node data into `FieldClaim.valueJson` unless the snapshot architecture is explicitly approved.** Storing entity fields in `valueJson` creates divergent copies that are difficult to reconcile with graph enrichment. |
| 5 | **Do not read `FieldClaim` rows as the source of truth for multi-value graph-bound fields.** The authoritative source is `ClientLEGraphEdge` (via the graph-binding read path in `getFieldDetail`). |

---

## 9. Related Files

| File | Role |
|---|---|
| `src/lib/kyc/FieldClaimService.ts` | `writeBackGraphEdge()` — writes FK claim and graph edge on selection |
| `src/actions/graph-node-picker.ts` | Server action — fetches picker items, alphabetical sort |
| `src/components/client/graph/graph-node-picker.tsx` | Popover picker UI component |
| `src/components/client/graph/graph-node-picker-dialog.tsx` | Dialog picker UI component |
| `src/components/client/inspection/field-detail-panel.tsx` | Renders reference field rows; `renderRowValue()` resolves display from live entity object |
| `src/actions/kyc-query.ts` | `getFieldDetail()` — graph-binding read path (lines ~548–592) |
| `src/lib/kyc/KycStateService.ts` | `mapToDerivedValue()` — claim-based value resolution |
| `scripts/backfill-graph-edge-toNodeId.ts` | One-time backfill for null-toNodeId edges written before the June 2026 fix |
| `docs/architecture/graph_snapshot_design.md` (in brain/artifacts) | Design notes for future snapshot capability |
