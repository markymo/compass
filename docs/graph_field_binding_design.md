# Graph Node Field Binding — Architecture Design

> **Status**: Design only. No code changes yet.  
> **Goal**: Allow a Master Field (e.g. Field 63 "List of company directors") to declare that its answers should be drawn from — and written back to — the LE Graph Node database, with no hardcoded field numbers anywhere in the UI or API layer.

---

## 1. Architecture Clarification: The Three-Layer Model

Before designing the binding, we need to be precise about how the existing system is layered, because the binding must sit at the correct layer.

### Layer 1 — Global Template: `MasterFieldDefinition`
This is the **admin-managed global catalogue** of all possible fields. It lives in the database table `master_field_definitions` and is managed at `/admin/master-data/manager`. Each field has a `fieldNo`, `fieldName`, `appDataType`, and associated `SourceFieldMapping` records.

This layer is **RA-agnostic and LE-agnostic**. It answers: *"What fields exist in the world?"*

### Layer 2 — Active Schema Snapshot: `MasterSchema`
The admin publishes a **versioned snapshot** of the field catalogue into a `MasterSchema` record. This record carries a `definition: Json` column — a point-in-time snapshot of the field structure. The `isActive` flag determines which version is currently in use.

`ClientLERecord` is linked to a `MasterSchema` version. This means an LE's data is always interpreted against a specific schema version. `FISchema` further allows a Financial Institution to apply an overlay on top of the master.

This layer answers: *"What does the schema look like at this point in time?"*

### Layer 3 — LE-Level Evidence: `FieldClaim`
Actual field values for a specific Legal Entity are stored as `FieldClaim` records. Each claim is scoped by `subjectLeId` (which `LegalEntity`) and `ownerScopeId` (which Organisation "owns" or asserted this claim). Claims are immutable and supersede each other via `supersedesId` — building a full audit lineage.

This layer answers: *"What is the current known value of Field X for Legal Entity Y, as asserted by Organisation Z?"*

### Where Does the Graph Node Binding Live?

The `MasterFieldGraphBinding` belongs at **Layer 1 — `MasterFieldDefinition`**. This is the correct place because:

- The binding declares the *nature* of a field (“this field expects a Person from the graph”) — a global, structural property, not an LE-specific one.
- It sits alongside `SourceFieldMapping`, which is also on Layer 1.
- The binding is serialized into the `MasterSchema` snapshot when published (see Section 1.5).

> [!NOTE]
> The `ownerScopeId` on `FieldClaim` means that when a user selects a graph node as an answer, the resulting claim will be scoped to their Organisation. This is correct — two different FIs could assert different directors for the same LE, and the `KycStateService` arbitrates which claim “wins” based on confidence and scope.

---

## 1.5 Snapshot Serialization Policy (Decision)

### The Decision: Serialize Everything

All `MasterFieldGraphBinding` properties — and all `SourceFieldMapping` records — will be **serialized into `MasterSchema.definition` when the admin publishes a new schema version**.

The rationale: the `writeBackEdgeType` on a binding has **permanent structural consequences**. When a user answers Field 63 and the system writes a `DIRECTOR` edge into the graph, that edge is a permanent historical record. If the binding later changed to `writeBackEdgeType = "SECRETARY"`, past assertions would be silently reinterpreted without a snapshot. The snapshot is the compliance anchor that prevents this.

This is a stronger requirement than for `SourceFieldMapping` (ingestion plumbing), but `GraphBinding` is closer in character to `appDataType` — it describes what a field *means*, not just how to populate it.

### Per-Property Breakdown

| Property | Serialize into Snapshot? | Reason |
|---|---|---|
| `fieldNo`, `fieldName` | ✅ Yes (already done) | Core identity |
| `appDataType` | ✅ Yes (already done) | Determines value type |
| `GraphBinding.graphNodeType` | ✅ Yes | Changes what picker shows |
| `GraphBinding.writeBackEdgeType` | ✅ **Definitely yes** | Creates permanent graph structure |
| `GraphBinding.filterEdgeType` | ✅ Yes | Affects which nodes are surfaced |
| `GraphBinding.filterActiveOnly` | ✅ Yes | UI/query behaviour tied to schema intent |
| `GraphBinding.allowCreate` | ✅ Yes | Determines if new nodes can be created via this field |
| `GraphBinding.pickerLabel` | ⚠️ Optional | Pure display hint; low semantic weight; include for completeness |
| `SourceFieldMapping.sourcePath` | ✅ **Now yes** | Should always have been included; ingestion behaviour is schema-version-specific |
| `SourceFieldMapping.transformType` | ✅ **Now yes** | Same reason |
| `SourceFieldMapping.confidenceDefault` | ✅ **Now yes** | Affects claim confidence at assertion time |

### What the Publish Step Must Now Do

When the admin publishes a new `MasterSchema` version, the publish action must serialize:

```
MasterSchema.definition = {
  version: <n>,
  publishedAt: <timestamp>,
  fields: [
    {
      fieldNo: 63,
      fieldName: "List of company directors",
      appDataType: "PARTY_REF",
      isMultiValue: true,
      ...
      sourceMappings: [
        { sourceType: "REGISTRATION_AUTHORITY", sourcePath: "officers[*]", transformType: "EXTRACT", confidence: 1.0 }
      ],
      graphBinding: {
        graphNodeType: "PERSON",
        filterEdgeType: "DIRECTOR",
        filterActiveOnly: true,
        writeBackEdgeType: "DIRECTOR",
        writeBackIsActive: true,
        allowCreate: true,
        pickerLabel: "Select a Director"
      }
    },
    ...
  ]
}
```

### The Working Copy vs. Audit Anchor Pattern

This creates a clean two-level contract:

- **`MasterFieldDefinition` (live)** = the working copy. Admins edit this. Changes here do not immediately affect existing LE data.
- **`MasterSchema.definition` (snapshot)** = the audit anchor. Frozen at publish time. Used to interpret all `FieldClaim` and `ClientLERecord` data created while that schema version was active.

For **UI rendering** (showing the picker to a user today), reading from the live `MasterFieldDefinition` is an acceptable shortcut — since the live definition and the most recent snapshot should be in sync between publishes. The snapshot is the source of truth only when interpreting *historical* data.

---

## 2. The Problem Statement

We currently have **two disconnected systems** that describe the same reality:

| System | What it stores | Who writes it |
|---|---|---|
| `FieldClaim` (Master Data) | "Field 63 = Person X is a director" | Ingestion pipeline or manual user |
| `ClientLEGraphNode` | "Person X exists in this LE's graph" | Registry enrichment (Companies House, etc.) |

The **link between them is implicit**: the graph page hardcodes `fieldNo: 63` to decide who is an "active director." This is fragile. If Field 63 changes meaning, or a new field (e.g. 64 = PSC controllers) needs to show in the graph, someone must update the code.

The deeper problem: the existing `SourceMapping` system handles **automated ingestion from external APIs** (GLEIF, Companies House). But it has **no concept of human-in-the-loop input**, and no concept of **graph node identity**.

---

## 2. The Insight: Two Different Mapping Concerns

It's important to keep these two concerns separate even though they're related:

### Concern A: Automated Ingestion Mapping
*"When Companies House returns JSON, which path becomes Field 63?"*

This is the existing `SourceFieldMapping` model. It is read-only for the ingestion engine. It produces `FieldClaim` records automatically. This system is already working well and should not be disturbed.

### Concern B: Graph Node Binding (NEW)
*"When a human is asked for the answer to Field 63, should they pick from a list of Person nodes in the LE Graph? And when they do, should that selection also write/update a graph node?"*

This is a **new, orthogonal concern** that needs its own data model.

---

## 3. The Proposed Extension: `MasterFieldGraphBinding`

### Core Idea

Add a new database table — `MasterFieldGraphBinding` — that lives on `MasterFieldDefinition` (just like `SourceFieldMapping` does today). It declares:

1. **What kind of graph node** answers this field (Person, Legal Entity, or Address)
2. **What role/edge type** that node plays in the graph when selected (e.g. DIRECTOR, PSC_CONTROL)
3. **Whether the selection should be filtered** (e.g. only active nodes, only certain edge types)
4. **Whether selecting an answer should also write-back** a graph node/edge (bidirectionality)

### Proposed Schema (Conceptual)

```
MasterFieldGraphBinding {
  id                String    @id
  fieldNo           Int       -- FK to MasterFieldDefinition
  
  // What the user sees in the picker
  graphNodeType     String    -- "PERSON" | "LEGAL_ENTITY" | "ADDRESS"
  filterEdgeType    String?   -- If set, only nodes with this edge type are shown
                              -- e.g. "DIRECTOR" to show only current directors
  filterActiveOnly  Boolean   -- Default true: hide ceased/historical nodes
  
  // What happens when the user SELECTS or CREATES a node
  writeBackEdgeType String?   -- If set, selecting a node also asserts a graph edge
                              -- e.g. "DIRECTOR" so a new person also gets an edge
  writeBackIsActive Boolean   -- Whether the written edge should be marked active
  
  // Display hint for the UI
  pickerLabel       String?   -- e.g. "Select a Director" (overrides generic label)
  allowCreate       Boolean   -- Default true: can the user add a NEW node from this picker?
  
  isActive          Boolean   @default(true)
  createdAt         DateTime
  updatedAt         DateTime
}
```

This table is **admin-managed**, visible and editable from the Master Data Manager field detail sheet — just like `SourceFieldMapping` records are today.

---

## 4. The User Flow (End-to-End)

### Scenario: A user answers Field 63 "List of company directors"

```
User is completing a KYC form / Master Data field
     │
     ▼
System reads MasterFieldGraphBinding for Field 63
→ graphNodeType = PERSON
→ filterEdgeType = DIRECTOR
→ filterActiveOnly = true
→ allowCreate = true
     │
     ▼
UI presents a "Graph Node Picker" component
  ┌─────────────────────────────────────────┐
  │ 🔍 Search directors...                  │
  ├─────────────────────────────────────────┤
  │ ● Jonathan Brazier Duffy   [Active]     │ ← Person node in graph
  │ ● Sarah Chen               [Active]     │ ← Person node in graph
  │ ○ Patricia Fellows         [Resigned]   │ ← Greyed out (filterActiveOnly)
  ├─────────────────────────────────────────┤
  │ + Add a new person                      │ ← allowCreate = true
  └─────────────────────────────────────────┘
     │
     ▼
User selects "Jonathan Brazier Duffy"
     │
     ├─── Write FieldClaim: fieldNo=63, valuePersonId=<jonathan's personId>
     │                      sourceType=USER_INPUT
     │
     └─── IF writeBackEdgeType = "DIRECTOR":
          Assert GraphEdge: fromNode=<jonathan's nodeId>, edgeType=DIRECTOR, isActive=true
          (only if edge doesn't already exist from ingestion)
```

### Scenario: User clicks "+ Add a new person"

```
User fills in a mini "New Person" form (name, DOB, nationality, occupation)
     │
     ▼
System creates:
  1. A new Person record in GlobalPerson table
  2. A new ClientLEGraphNode (PERSON) linked to the LE
  3. A FieldClaim: fieldNo=63, valuePersonId=<new person>
  4. IF writeBackEdgeType set: a ClientLEGraphEdge (DIRECTOR, isActive=true)
     │
     ▼
Graph Explorer refreshes — new person appears in Officers branch
```

---

## 5. Bidirectionality: The Critical Design Decision

The binding has two directions that must be handled independently:

### Direction A: Graph → Field Claim (Read / Display)
*"Show me all person nodes with a DIRECTOR edge as the answer to Field 63"*

Used by:
- The **Graph Explorer** (already doing this, but hardcoded)
- The **KYC Workbench** to display "who have we named as directors?"

This is a **query concern** — given a `MasterFieldGraphBinding`, construct the correct Prisma query dynamically.

### Direction B: Field Claim → Graph (Write / Sync)
*"When a user asserts a value for Field 63, also ensure the LE graph reflects that"*

This is a **write concern** — when `FieldClaimService.assertClaim()` is called for a field that has a `writeBackEdgeType`, it should also upsert the appropriate graph node/edge.

> [!IMPORTANT]  
> Direction B must be **opt-in per binding** and **idempotent**. If Companies House already wrote the graph node (via ingestion), we should NOT create a duplicate — we should recognise the existing node by `personId` and skip or merge.

---

## 6. Why This Is More Flexible Than What We Have

| Capability | Current System | Proposed System |
|---|---|---|
| Which field = "directors"? | Hardcoded `fieldNo === 63` in graph page | Read from `MasterFieldGraphBinding` at runtime |
| Which field = "PSC controllers"? | Hardcoded separately | Just add another `MasterFieldGraphBinding` row |
| Admin can change the field-to-graph mapping | No | Yes, via the Master Data Manager |
| New RA adds a different field for directors | Requires code change | Add `MasterFieldGraphBinding` for the new field |
| User can pick from existing nodes | Not wired up | Core feature of the "Graph Node Picker" component |
| User can create a new node mid-answer | Not supported | Supported via `allowCreate = true` |
| Created nodes appear in the graph immediately | No | Yes, graph node is written as part of claim assertion |

---

## 7. What Needs to Be Built (Phased)

### Phase 1 — Data Model & Admin UI
1. Add `MasterFieldGraphBinding` to Prisma schema
2. Add a "Graph Binding" section to the `FieldDetailSheet` in the admin, below "Source Mappings"
3. A simple form: pick node type, edge type filter, allow-create toggle, write-back edge type

### Phase 2 — Dynamic Query Layer
1. In `graph/page.tsx`, replace the hardcoded `fieldNo: 63` query with a lookup against `MasterFieldGraphBinding` 
2. `KycStateService.getAuthoritativeCollection()` should be graph-binding-aware for `PARTY_REF` fields

### Phase 3 — Graph Node Picker UI Component
1. A new reusable `GraphNodePicker` component that:
   - Accepts `fieldNo` as a prop
   - Fetches `MasterFieldGraphBinding` for that field
   - Queries the LE's graph nodes filtered by `graphNodeType` and `filterEdgeType`
   - Renders a searchable, filterable list
   - Supports inline "Add new person/entity" flow
2. This component replaces any manual text entry for `PARTY_REF`/`PERSON_REF` fields

### Phase 4 — Write-Back on Claim Assertion
1. In `FieldClaimService.assertClaim()`, after writing the claim, check if the field has a `writeBackEdgeType` binding
2. If yes, and the `valuePersonId` / `valueLeId` is set, upsert the graph node and edge accordingly
3. Must be idempotent — do not duplicate existing edges from ingestion

---

## 8. Key Constraints & Guard Rails

> [!WARNING]
> The write-back (Phase 4) must only trigger for `SOURCE_TYPE = USER_INPUT`. Automated ingestion via `SourceFieldMapping` already manages graph nodes directly. If write-back ran for ingested claims too, you would get double-write conflicts.

> [!NOTE]
> The "Graph Node Picker" component should show nodes from the **entire LE graph**, not just nodes that are already answers to this field. The filter (`filterEdgeType`) controls which nodes are **promoted to the top** of the list, not which are excluded entirely. This means a user can select a person who is currently a PSC as a director if they choose to — the system records it, and the admin can review.

> [!TIP]
> For Phase 1, the `filterEdgeType` and `writeBackEdgeType` can be the same value in most cases (e.g. both = "DIRECTOR"). But they should remain separate fields because some bindings may want to show nodes of one edge type but write back a different one (e.g. show all people, but write a SIGNATORY edge).

---

## 9. How The Explorer Changes

Once the binding system is complete, the Graph Explorer reads from **`ClientLEGraphEdge`** — the permanent structural record written at claim-assertion time. This is stable and independent of whether a binding is active or not.

The explorer's `page.tsx` changes from:

```ts
// BEFORE (hardcoded FieldClaim lookup)
const activeDirectorClaims = await prisma.fieldClaim.findMany({
    where: { subjectLeId, fieldNo: 63, valuePersonId: { not: null } }
});
const activeDirectorPersonIds = activeDirectorClaims.map(c => c.valuePersonId);
```

To:

```ts
// AFTER (reads from graph edges — stable, binding-independent)
const directorEdges = await prisma.clientLEGraphEdge.findMany({
    where: { clientLEId, edgeType: 'DIRECTOR', isActive: true }
});
// directorEdges.map(e => e.fromNodeId) gives us the active director graph nodes directly
```

The explorer no longer needs to know about field numbers at all. It reads from the graph edges that were written when claims were asserted. This means:

- **Zero code changes** when a new field (e.g. Field 120 for a German RA) is bound to `writeBackEdgeType = DIRECTOR` — its write-back populates the same `DIRECTOR` edges, and the explorer picks them up automatically.
- **Deleting a binding** does not remove anyone from the explorer — because the edges persist independently.
- **Multi-RA support** is structural, not configurational.

---

## 10. Resolved Design Decisions

All three open questions have been discussed and resolved. These are now closed.

### Decision 1 — RA-Specific Bindings: **Not needed**

`MasterFieldGraphBinding` will **not** have a `registrationAuthorityId` column.

**Rationale**: RA differentiation is correctly handled at the `SourceFieldMapping` layer (different source paths per RA). The `GraphBinding` operates at the conceptual level — *what does this field mean in the graph* — which is RA-agnostic. If two different RAs use different field numbers for the same concept (e.g. directors), each field gets its own `MasterFieldGraphBinding` record both pointing to `writeBackEdgeType = DIRECTOR`. The Graph Explorer, reading from `ClientLEGraphEdge`, picks up both without needing to know about RAs at all.

### Decision 2 — Verification Workflow: **Always `ASSERTED`; confidence varies by provenance**

All picker assertions produce a `FieldClaim` with `status = ASSERTED`. `VERIFIED` is always an explicit, separate human/compliance action — never automatic.

| User action | Confidence | Evidence |
|---|---|---|
| Selects a registry-ingested node (e.g. Companies House person) | 0.9 | `evidenceId` pointing to original registry ingestion |
| Selects a manually-added node | 0.7 | None |
| Creates a brand new person inline | 0.6 | None |

**Rationale**: The existing `FieldClaimService` already separates `assertClaim` and `verifyClaim`. The picker always calls `assertClaim`. The fact that the underlying node came from a trusted registry makes the claim *stronger* (higher confidence) but not automatically *verified* — the user is making their own assertion, not relaying a registry verdict.

### Decision 3 — Deletion Propagation: **Explorer is unaffected; only future behaviour changes**

Deleting or deactivating a `MasterFieldGraphBinding` record:
- ✅ Removes the picker UI for that field on future inputs
- ✅ Stops future claims from triggering graph edge write-back
- ❌ Does **not** alter existing `FieldClaim` records (immutable by design)
- ❌ Does **not** remove existing `ClientLEGraphEdge` records (permanent structural records)
- ❌ Does **not** change the Graph Explorer display (which reads from graph edges, not bindings)

**Rationale**: `ClientLEGraphEdge` is the stable, queryable source of truth for the explorer. It is written once at claim-assertion time and persists regardless of binding configuration. This clean separation means the explorer is robust to any admin changes to binding config.

---

## 11. Status: Design Complete ✅

This document is approved and ready for implementation. See Section 7 for the phased build plan.

> [!IMPORTANT]
> **Prerequisite before Phase 1**: Update the existing schema publish step to also serialize `SourceFieldMapping` records into `MasterSchema.definition`. This is a low-risk, standalone change that establishes the correct snapshot contract before `GraphBinding` serialization is added on top.
