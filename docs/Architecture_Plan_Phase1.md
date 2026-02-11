# Architecture Plan: Phase 1 - KYC Data Model & Traceability (Revised)

## 1. Executive Summary

This architecture implements a robust "Middle Path" solution for the Onboarding Data Model. It balances the need for strict data integrity (relational) with the flexibility of diverse provenance tracking (JSONB).

**Core Philosophy:**
1.  **Legal Entity as Aggregate Root**: The source of truth for an entity's identity.
2.  **Relational Modules**: Domain-specific tables (e.g., `identity_profiles`, `tax_profiles`) store current, verified data in typed columns.
3.  **Traceability via Metadata Overlay**: Every data row includes a `_meta` JSONB column. This maps each attribute (not just the row) to its source, timestamp, and most importantly, its canonical **Field No**.
4.  **Immutable Evidence**: Raw source payloads are stored in a content-addressable `evidence_store` and linked by reference, ensuring auditability without duplication.

---

## 2. Updated Data Model Overview

### 2.1 The Aggregate Root: `legal_entities`
The `legal_entities` table is the anchor. It contains the system's internal ID, public reference, and overall status. It does *not* contain domain data (name, address, etc.), which plays out in modules.

### 2.2 Functional Modules (Sub-Aggregates)
Data is grouped into **Modules**, implemented as standard Postgres tables.
*   **1:1 Modules**: Examples: `identity_profiles` (Name, Incorp Date), `tax_profiles` (FATCA/CRS).
*   **1:N Modules**: Examples: `directors`, `shareholders`, `settlement_instructions`.
*   **Lifecycle**: Each module record has a `status` (DRAFT, IN_REVIEW, VERIFIED, HISTORIC).

### 2.3 The Onboarding Request (Context)
A separate `onboarding_requests` entity manages the *business process*.
*   It links a `legal_entity` to a specific product/jurisdiction/FI.
*   It defines *which modules are required* for that specific request (e.g., "US Tax Module" required for US trading).
*   This separates "Data State" (Modules) from "Process State" (Onboarding).

---

## 3. Traceability Traceability Pattern (Field No Linkage)

We introduce a **Metadata Overlay** strategy to link physical columns to logical **Field Nos**.

### 3.1 The `_meta` Column
Every module table includes a `_meta` column of type `JSONB`. The structure is a map of `column_name` -> `provenance_object`.

**Abstract Metadata Schema:**
```json
{
  "column_name": {
    "field_no": INTEGER,       // The Canonical Field No (Source of Truth)
    "source": STRING,          // "GLEIF", "USER", "COMPANIES_HOUSE"
    "evidence_id": UUID,       // Link to raw payload in evidence_store
    "timestamp": ISO8601,
    "confidence": FLOAT,
    "verified_by": USER_ID
  }
}
```

### 3.2 Symbolic Examples (NOT Real Field Nos)

#### Example A: Single-Value Field (Legal Name)
*   **Table**: `identity_profiles`
*   **Column**: `legal_name` = "Acme Corp"
*   **`_meta`**:
    ```json
    {
      "legal_name": {
        "field_no": 1001,  // Symbolic ID for "Legal Name"
        "source": "GLEIF",
        "evidence_id": "Ev-UUID-1",
        "timestamp": "2024-02-10T10:00:00Z"
      }
    }
    ```

#### Example B: Repeating Group (Directors)
*   **Table**: `directors` (1:N)
*   **Row 1**: `first_name`="Jane", `last_name`="Doe"
*   **`_meta`**:
    ```json
    {
      "first_name": { "field_no": 2005, "source": "COMPANIES_HOUSE", "evidence_id": "Ev-UUID-2" },
      "last_name":  { "field_no": 2006, "source": "COMPANIES_HOUSE", "evidence_id": "Ev-UUID-2" }
    }
    ```
*   **Row 2**: `first_name`="John", `last_name`="Smith"
*   **`_meta`**:
    ```json
    {
      "first_name": { "field_no": 2005, "source": "USER_INPUT" },
      "last_name":  { "field_no": 2006, "source": "USER_INPUT" }
    }
    ```

**Traceability Guarantee**:
A query can find *any* director's surname sourced from "User Input" by querying the `_meta` JSONB path `last_name -> source`.

---

## 4. Provenance & Queryability Strategy

### Recommendation: `_meta` Column Only (No separate 'Claims' table)

**Rationale:**
1.  **Data Locality**: The provenance lives alongside the data. When you fetch a Director, you get their source immediately. No complex joins.
2.  **Performance**: Postgres JSONB is highly efficient. Creating a GIN index on `_meta` allows performant queries like `WHERE _meta @> '{"legal_name": {"source": "GLEIF"}}'`.
3.  **Simplicity**: A separate "Claims" table introduces synchronization risks (referential integrity drift) and doubles the write volume.

**Operational vs Audit Queries:**
*   **Operational (Fast)**: "Show me the Legal Name." -> `SELECT legal_name FROM identity_profiles`. (Instant, relational).
*   **Provenance (Fast enough)**: "Show me fields sourced from GLEIF." -> `SELECT * FROM identity_profiles WHERE _meta->'legal_name'->>'source' = 'GLEIF'`. (Indexed JSONB).

---

## 5. Evidence Store Hardening

The `evidence_store` is the immutable bedrock of audit.

**Table Schema: `evidence_store`**
*   `id` (UUID, PK)
*   `hash` (SHA-256 string, Unique Index) - *Enforces deduplication.*
*   `provider` (Enum: `GLEIF`, `COMPANIES_HOUSE`, `USER_UPLOAD`)
*   `payload` (JSONB) - *The raw, complete response.*
*   `schema_version` (String) - *e.g., "v1.0" (handles provider API changes).*
*   `retrieved_at` (Timestamp)
*   `captured_by` (UUID, User/System ID)

**Linkage Strategy:**
*   Modules link to Evidence via `_meta.evidence_id`.
*   **Modules do NOT duplicate evidence data**, only reference it.
*   **Immutability**: This table should be `append-only`.

---

## 6. Naming Convention Spec (Final)

We adopt a strict standard to prevent drift.

| Object Type | Rule | Example |
| :--- | :--- | :--- |
| **Postgres Tables** | `snake_case`, **plural** | `legal_entities`, `identity_profiles`, `directors` |
| **Columns** | `snake_case` | `legal_name`, `tax_residency`, `is_active` |
| **Primary Keys** | `id` (UUID) | `id` |
| **Foreign Keys** | `singular_table_name` + `_id` | `legal_entity_id`, `onboarding_request_id` |
| **JSONB Meta** | `_meta` (always) | `_meta` |
| **Enums** | `PascalCase` (Prisma default) or `UPPER_SNAKE` (DB) | `UserRole`, `OnboardingStatus` |
| **Prisma Models** | `PascalCase`, **singular** | `LegalEntity`, `IdentityProfile`, `Director` |

**Specific Table Examples:**

1.  **DB**: `legal_entities` -> **Prisma**: `LegalEntity`
2.  **DB**: `identity_profiles` -> **Prisma**: `IdentityProfile` (1:1 Module)
3.  **DB**: `tax_profiles` -> **Prisma**: `TaxProfile` (1:1 Module)
4.  **DB**: `directors` -> **Prisma**: `Director` (1:N Module)
5.  **DB**: `evidence_store` -> **Prisma**: `Evidence` (Naming exception for clarity)

---

## 7. Risks & Mitigations (Updated)

### Risk 1: "Field No" Drift
*   **Risk**: The spreadsheet definition for Field 1001 changes from "Legal Name" to "Trading Name".
*   **Mitigation**:
    *   **Code-First Dictionary**: `FieldDefinitions.ts` is the source of truth in code.
    *   **Validation**: Start-up script verifies `FieldDefinitions` matches the DB schema expectations.
    *   **Versioning**: If Field Nos change semantics, we must use a *new* Field No (e.g., 1001_v2 or new ID). IDs must be immutable.

### Risk 2: JSONB "Schema-less" Chaos
*   **Risk**: Developers putting random data into `_meta` or `payload`.
*   **Mitigation**:
    *   **Zod Schemas**: Strict Zod validation for the `_meta` column structure before writing.
    *   **Typed Wrappers**: DB access should go through typed Data Access Objects (DAOs) only, never raw SQL inserts.

### Risk 3: Reporting Complexity
*   **Risk**: BI tools struggle with JSONB.
*   **Mitigation**:
    *   Core reporting data is Relational.
    *   Provenance reporting (less frequent) can use Postgres JSON operators or be flattened into a materialized view if volume demands it.

---

## 8. Assumptions (Pending Review)

1.  **Field No Universality**: We assume every single data attribute we care about corresponds to *at least* one Field No. (If not, we need "internal" Field Nos).
2.  **Repeating Group IDs**: We assume the spreadsheet defines Repeating Groups (e.g., "Directors") as a block, and we don't need distinct Field Nos for "Director 1 Name" vs "Director 2 Name" (it's "Director Name" field, instanced N times).
3.  **Evidence Scope**: We assume `evidence_store` payloads are moderate in size (MBs, not GBs). Large files (PDFs) stay in S3, and `evidence_store` holds the metadata/link.

---
The next bit is a human friendly explanation of our archtectural thinking on this Data Schema as generated by Chat GPT

# Architecture Rationale – Why This Design Exists

This document explains **what we have designed and why**, in plain terms.  
It is intended to complement `Architecture_Plan_Phase1.md` by capturing the *thinking* behind the structure, not just the structure itself.

---

## 1. The Real Problem We Are Solving

This system is not “a form backed by a database”.

It is an **onboarding and KYC engine** where every answer must be:
- explainable
- auditable
- reusable
- evidence-backed
- resilient to regulatory and process change

Financial institutions do not just ask *what* the answer is.  
They ask:

- Where did it come from?
- When was it obtained?
- Who provided or verified it?
- What evidence supports it?
- Is it still valid for *this* deal?

The architecture is designed to answer those questions **by construction**, not by convention.

---

## 2. Designs We Explicitly Avoided (and Why)

### 2.1 One Giant JSON Blob

Storing the entire onboarding record as a single JSON document is tempting, but fails because:
- It is hard to query (“find all entities failing sanctions”)
- It provides no structural guarantees
- Auditing becomes guesswork
- Business logic slowly leaks everywhere

This approach optimises for speed today and pain tomorrow.

---

### 2.2 Fully Normalised “One Question = One Row” (EAV)

Treating every question as an abstract `(question_id, value)` row:
- destroys type safety
- makes queries unreadable
- forces heavy joins and pivots
- does not match how humans or regulators think

In practice, teams end up rebuilding “sections” and “modules” on top of this anyway.

---

### 2.3 Mirroring the Spreadsheet Literally

Spreadsheets:
- contain duplicated concepts
- mix instructions with data
- evolve informally
- lie about structure

Locking today’s spreadsheet directly into a schema freezes those problems permanently.

---

## 3. What We Designed Instead (“The Middle Path”)

### 3.1 Legal Entity as the Aggregate Root

At the centre of the system is a single concept:

> **The Legal Entity**

This represents the existence of a company in the system — nothing more.

The `legal_entities` table does **not** store:
- names
- addresses
- tax data
- sanctions

Those belong in modules that can evolve, be re-verified, and be reused.

---

### 3.2 Domain Modules Reflect Reality

Data is grouped into **modules** that correspond to real onboarding sections:
- Identity
- Ownership & Control
- Tax
- Sanctions & Risk
- Trading Authorisation
- Contacts
- Settlement Instructions

Each module:
- is its own table (or small group of tables)
- can exist or not
- can be draft / verified / historic
- can be required for one onboarding request and irrelevant for another

This mirrors:
- how banks structure onboarding
- how users provide data
- how audits are conducted

---

### 3.3 Repetition Is Modelled Explicitly

Some data exists once:
- legal name
- incorporation date

Some data exists many times:
- directors
- UBOs
- authorised traders
- bank accounts

These are modelled using **1:N tables**, not duplicated columns or artificial limits.

This keeps the model honest and extensible.

---

## 4. The Key Insight: Separate Facts from Provenance

The most important design decision is this:

> **We store the value and the explanation of the value separately — but linked.**

### 4.1 Typed Columns Hold the “Current Truth”

Relational columns store the *best current understanding*:
- `legal_name`
- `lei_code`
- `tax_residency`
- etc.

These are easy to query, validate, and reason about.

---

### 4.2 `_meta` Stores Provenance, Not Data

Every table that stores Field-No-mapped data has a `_meta` JSONB column.

For each attribute, `_meta` records:
- which **Field No** it corresponds to
- where the value came from (GLEIF, Companies House, user input)
- which evidence supports it
- when it was verified
- who/system verified it

This avoids:
- column explosion (`legal_name_source`, `legal_name_timestamp`, …)
- hidden assumptions
- loss of audit context

**Invariant:**  
If a value mapped to a Field No exists, a corresponding `_meta` entry must exist.

---

## 5. Evidence Is Immutable and First-Class

Raw source data (API payloads, uploaded documents, extracts) is stored in an **append-only `evidence_store`**.

Key principles:
- evidence is never edited
- payloads are deduplicated by hash
- extracted values reference evidence by ID
- provenance always points back to immutable source material

This ensures the system can always answer:
> “What exactly did we see at the time we made this claim?”

---

## 6. Documents Are Not Special-Cased

Some onboarding “answers” are:
- documents
- free-text attestations
- or either

We treat documents as first-class records in a generic `document_registry` that can attach to:
- legal entities
- stakeholders
- authorised traders

Documents are linked by:
- ownership (who they belong to)
- Field No (why they exist)
- evidence/provenance (how they were supplied)

This avoids brittle, hard-coded document handling.

---

## 7. Process Is Separated from Truth

We explicitly separate:
- **What is true about an entity**
from
- **What a specific bank, product, or jurisdiction requires**

Onboarding requests:
- reference existing modules
- declare which modules are required
- enforce completeness at submission time, not creation time

This enables:
- “answer once, reuse many times”
- parallel onboarding to multiple institutions
- evolving requirements without duplicating data

---

## 8. Why This Architecture Will Age Well

This design:
- tolerates new fields and regulations
- supports re-verification and overrides
- remains explainable under audit
- avoids large-scale rewrites
- stays understandable to humans

It does not optimise for cleverness.
It optimises for **trust, clarity, and longevity**.

---

## 9. Summary

We did not design a database schema.

We designed:
- a way to separate fact from evidence
- a system that explains itself
- an onboarding engine that respects how regulation actually works

> **This architecture is intentionally boring — and therefore correct.**

