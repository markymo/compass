# Architecture Plan: Phase 2 - As-Built Implementation

## 1. Executive Summary

This document records the **as-built architecture** of the Phase 2 KYC implementation, delivered in February 2026. This phase successfully transitioned the system from a conceptual design to a working, type-safe, and validated service layer.

**Key Achievements:**
*   **Schema Deployed**: 21 new tables implementing the "Legal Entity + Profiles" model.
*   **Type Safety Enforced**: `FieldDefinitions.ts` acts as the compiled source of truth for 118 data fields.
*   **Provenance Guaranteed**: The `KycWriteService` strictly enforces that every data write includes source, timestamp, and verifier metadata.
*   **API Exposed**: Secure Server Actions (`src/actions/kyc.ts`) provide a typed bridge for the frontend.

---

## 2. Schema Implementation (Phase 2A)

The database schema was deployed to Neon PostgreSQL without data migration (a "parallel adoption" strategy).

### 2.1 Core Structure
*   **`legal_entities`**: The aggregate root.
*   **`evidence_store`**: Immutable, content-addressable storage for raw API payloads and verification proofs.
*   **`document_registry`**: A polymorphic table ensuring documents can be linked to Entities, Stakeholders, or Traders while maintaining Field No traceability.

### 2.2 Profile Modules (1:1)
Eleven distinct tables store domain-specific data, replacing the previous "flat" approach. 
*   **Examples**: `identity_profiles`, `tax_profiles`, `compliance_profiles`.
*   **Design**: Each profile has a `meta` JSONB column enforcing the provenance invariant.

### 2.3 Repeating Modules (1:N)
Seven tables handle repeating data structures.
*   **Examples**: `stakeholders` (Directors/UBOs), `authorized_traders` (Field 96-101), `settlement_instructions`.
*   **Design**: Explicit 1:N relationships with generic `meta` support.

---

## 3. Type Safety & Validation (Phase 2B)

We rejected a "loose JSON" approach in favor of strict, code-first definitions.

### 3.1 `FieldDefinitions.ts`
This file is the **governing dictionary** of the system.
*   Maps every `Field No` (e.g., 96) to a specific `Table` and `Column`.
*   Prevents developer error: You cannot write to a field that doesn't exist in the dictionary.
*   Runtime validation ensures the definition matches the database schema.

### 3.2 Zod Schemas
*   **`MetaSchema`**: Hard invariant. Every write *must* include provenance.
*   **`DocumentRegistrySchema`**: Validates the polymorphic links (e.g., ensuring an `ownerId` is a valid UUID).
*   **Module Schemas**: Allow partial updates (Draft state) but enforce strict types (e.g., Date objects, Enums).

---

## 4. Service Layer Architecture (Phase 2C)

The Service Layer abstracts database complexity and enforces business invariants.

### 4.1 `KycWriteService`
The "Brain" of the write operations.
*   **Universal `updateField`**: Routes data to the correct 1:1 table based on Field No.
*   **Repeating Row Support**: Handles 1:N creation for Traders and Stakeholders.
*   **Provenance Injection**: Automatically stamps every write with `verifiedBy` and `timestamp`.
*   **Atomic Transactions**: Uses Prisma transactions to ensure data and metadata stay in sync.

### 4.2 `DocumentService`
*   **Lifecycle Management**: Validates upload requests -> Mocks S3 upload -> Creates Registry Entry.
*   **Polymorphism**: Handles the complex logic of linking a document to a "Trader" vs a "Legal Entity".

### 4.3 `ModuleValidator`
The "Gatekeeper" for workflow transitions.
*   **Completeness Checks**: Verifies required fields (e.g., "Legal Name is mandatory for Identity").
*   **Complex Rules**: Implements the "Field 100" logic for Authorized Traders (Must have Document OR Attestation).
*   **Integration**: callable from the Question/Questionnaire state machine logic.

---

## 5. API Layer (Phase 2E)

We implemented **Next.js Server Actions** as the primary API surface, ensuring type safety from DB to UI.

### 5.1 `src/actions/kyc.ts`
This file exposes the service layer to the frontend.

*   **Authorization**: Uses `getIdentity()` and a custom RBAC check (`ensureKycAuthorization`) to protect all writes.
*   **Actions**:
    *   `updateKycField`: Generic handler for 1:1 profile updates.
    *   `createAuthorizedTrader`: Specialized handler for 1:N rows.
    *   `validateKycModule`: Triggers validation feedback.
    *   `uploadKycDocument`: Securely handles `FormData` for file uploads.

---

## 6. Verification Strategy

The architecture was verified through a multi-tiered approach:
1.  **Unit Tests (Vitest)**: 56 tests covered the Type Safety layer (Schemas, Field Definitions).
2.  **Integration Script (`verify_phase2c_services.ts`)**: A standalone script exercised the full "Create Entity -> Write Data -> Upload Doc -> Validate" loop against the live development database.
3.  **Type Checking**: Strict TypeScript compilation ensures the Server Actions correctly interface with the Prisma services.

---

## 7. Conclusion

The Phase 2 architecture is now **live and ready for UI integration**. It provides a robust, auditable foundation for the Compass KYC workflow, solving the "provenance problem" by design.
