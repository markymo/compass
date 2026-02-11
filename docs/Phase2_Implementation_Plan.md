# Phase 2 Implementation Plan: KYC Data Model

## 1. Final Table List & Relationships

### Core Tables

#### `legal_entities` (Aggregate Root)
- `id` UUID PK
- `reference` STRING (public identifier)
- `created_at`, `updated_at` TIMESTAMP
- **Relationships**: 1:1 to all `*_profiles`, 1:N to repeating tables

#### `evidence_store` (Immutable Evidence)
- `id` UUID PK
- `hash` STRING (SHA-256, unique index)
- `provider` ENUM (`GLEIF`, `COMPANIES_HOUSE`, `USER_UPLOAD`)
- `payload` JSONB
- `schema_version` STRING
- `retrieved_at` TIMESTAMP
- `captured_by` UUID
- **Relationships**: Referenced by `_meta.evidence_id` across all tables

#### `document_registry` (Polymorphic Document Store)
- `id` UUID PK
- `legal_entity_id` UUID FK (for scoping/permissions)
- `owner_type` ENUM (`LEGAL_ENTITY`, `STAKEHOLDER`, `AUTHORIZED_TRADER`)
- `owner_id` UUID (polymorphic)
- `field_no` INTEGER (traceability to Master Schema)
- `file_path` STRING (S3 key or storage reference)
- `file_name` STRING
- `mime_type` STRING
- `uploaded_at` TIMESTAMP
- `uploaded_by` UUID
- **Indexes**: `(legal_entity_id)`, `(owner_type, owner_id)`, `(field_no)`

### 1:1 Profile Modules (Legal Entity)

All include: `id` UUID PK, `legal_entity_id` UUID FK UNIQUE, `_meta` JSONB, `created_at`, `updated_at`

1. **`identity_profiles`** - Fields 1-3, 6-10, 11-15, 26-27
2. **`entity_info_profiles`** - Fields 19-25
3. **`lei_registrations`** - Fields 28-35
4. **`relationship_profiles`** - Fields 36-55
5. **`constitutional_profiles`** - Fields 16-18, 57-59
6. **`compliance_profiles`** - Fields 75-80
7. **`tax_profiles`** - Field 83 (FATCA status only)
   - Note: Field 82 (W-8BEN-E) and Field 84 (CRS Self-Certification) are document-only, stored in `document_registry`
8. **`financial_profiles`** - Fields 85-90
9. **`derivatives_profiles`** - Fields 91-93, 110-112 (document refs)
10. **`trading_profiles`** - Fields 102-103 (board minute refs)
11. **`contact_profiles`** - Fields 107-109, 113-115

### 1:N Repeating Tables

All include: `id` UUID PK, `legal_entity_id` UUID FK, `_meta` JSONB, `created_at`, `updated_at`

1. **`entity_names`** - Fields 4-5
   - `name` STRING, `type` ENUM (`TRADING_AS`, `PREVIOUS`, `LEGAL`)

2. **`industry_classifications`** - Field 20
   - `code` STRING, `scheme` STRING (`UK_SIC`, etc.)

3. **`stakeholders`** - Fields 65-73
   - Individual: `full_name`, `date_of_birth`, `place_of_birth`, `nationalities` JSONB
   - Corporate: `legal_name`, `lei_code`, `registration_number`
   - `stakeholder_type` ENUM (`INDIVIDUAL`, `CORPORATE`)
   - `role` ENUM (`DIRECTOR`, `UBO`, `CONTROLLER`)
   - `id_document_id` UUID FK (to `document_registry`, Field 68)

4. **`tax_registrations`** - Field 81
   - `tax_id` STRING, `country` STRING

5. **`authorized_traders`** - Fields 96-101
   - `full_name`, `email`, `phone`, `mobile` STRING
   - `products` JSONB (array)
   - `authority_document_id` UUID FK (nullable, to `document_registry`)
   - `authority_attestation_text` TEXT (nullable)
   - **Validation**: At workflow gate (VERIFIED), at least one of `authority_document_id` OR `authority_attestation_text` must be populated

6. **`contacts`** - Fields 104-106
   - `address` TEXT, `attention` STRING, `email` STRING
   - `contact_type` ENUM (`NOTICE`, `PROCESS_AGENT`, etc.)

7. **`settlement_instructions`** - Fields 116-119
   - `currency` STRING, `account_name` STRING, `account_number` STRING, `iban_swift` STRING

---

## 2. Migration Order

### Phase 2A: Foundation
1. `legal_entities` (root)
2. `evidence_store` (support)
3. `document_registry` (support)

### Phase 2B: 1:1 Profiles (parallel-safe)
4. `identity_profiles`
5. `entity_info_profiles`
6. `lei_registrations`
7. `relationship_profiles`
8. `constitutional_profiles`
9. `compliance_profiles`
10. `tax_profiles`
11. `financial_profiles`
12. `derivatives_profiles`
13. `trading_profiles`
14. `contact_profiles`

### Phase 2C: 1:N Repeating Tables (parallel-safe)
15. `entity_names`
16. `industry_classifications`
17. `stakeholders`
18. `tax_registrations`
19. `authorized_traders`
20. `contacts`
21. `settlement_instructions`

**Rollback Strategy**: Each phase is independently reversible. No data migration from existing `ClientLE` until Phase 2D (separate plan).

---

## 3. FieldDefinitions.ts Structure

```typescript
// src/domain/dictionary/FieldDefinitions.ts

export type FieldDefinition = {
  fieldNo: number;
  fieldName: string;
  table: string;
  column: string | null; // null for document-only fields
  dataType: 'string' | 'integer' | 'boolean' | 'date' | 'jsonb' | 'document';
  isRepeating: boolean;
  notes?: string;
};

export const FIELD_DEFINITIONS: Record<number, FieldDefinition> = {
  1: {
    fieldNo: 1,
    fieldName: 'LEI validation date',
    table: 'identity_profiles',
    column: 'lei_validation_date',
    dataType: 'date',
    isRepeating: false,
  },
  2: {
    fieldNo: 2,
    fieldName: 'LEI',
    table: 'identity_profiles',
    column: 'lei_code',
    dataType: 'string',
    isRepeating: false,
  },
  // ... 3-93, 95-119 (excluding 94)
  56: {
    fieldNo: 56,
    fieldName: 'Constitutional and Formation Documents',
    table: 'document_registry',
    column: null,
    dataType: 'document',
    isRepeating: false,
    notes: 'Document upload only',
  },
  65: {
    fieldNo: 65,
    fieldName: 'Full name',
    table: 'stakeholders',
    column: 'full_name',
    dataType: 'string',
    isRepeating: true,
  },
  // ... etc
};

// Validation helper
export function getFieldDefinition(fieldNo: number): FieldDefinition {
  const def = FIELD_DEFINITIONS[fieldNo];
  if (!def) throw new Error(`Unknown Field No: ${fieldNo}`);
  return def;
}
```

**Coverage**: All active canonical Field Nos in the range 1-119 (Field 94 is currently a placeholder with no data mapping)

---

## 4. Zod Schema Strategy

### 4.1 `_meta` Schema (Universal)

```typescript
// src/domain/kyc/schemas/MetaSchema.ts

import { z } from 'zod';

export const MetaEntrySchema = z.object({
  field_no: z.number().int().min(1), // Validated against FieldDefinitions.ts, not numeric bounds
  source: z.enum(['GLEIF', 'COMPANIES_HOUSE', 'USER_INPUT', 'SYSTEM']),
  evidence_id: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  verified_by: z.string().uuid().optional(),
});

export const MetaSchema = z.record(z.string(), MetaEntrySchema);
// Usage: { "legal_name": { field_no: 3, source: "GLEIF", ... } }

// Hard invariant validator
export function validateMetaForFields(
  meta: unknown,
  data: Record<string, unknown>,
  tableName: string,
  fieldDefinitions: Record<number, FieldDefinition>
): void {
  const parsed = MetaSchema.parse(meta);
  
  // Get columns mapped to Field Nos for THIS table only (prevent cross-table collisions)
  const mappedColumns = Object.values(fieldDefinitions)
    .filter(def => def.table === tableName && def.column !== null)
    .map(def => def.column);
  
  // Only validate _meta for columns that are:
  // 1. Populated (non-null)
  // 2. Mapped to a Field No in this specific table
  for (const [column, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (!mappedColumns.includes(column)) continue; // Skip system columns and other tables
    
    if (!parsed[column]) {
      throw new Error(`Missing _meta entry for field: ${column}`);
    }
    if (!parsed[column].field_no) {
      throw new Error(`Missing field_no in _meta for: ${column}`);
    }
  }
}
```

### 4.2 Document Registry Schema

```typescript
// src/domain/kyc/schemas/DocumentSchema.ts

export const DocumentRegistrySchema = z.object({
  legal_entity_id: z.string().uuid(),
  owner_type: z.enum(['LEGAL_ENTITY', 'STAKEHOLDER', 'AUTHORIZED_TRADER']),
  owner_id: z.string().uuid(),
  field_no: z.number().int().min(1), // Validated against FieldDefinitions.ts
  file_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  uploaded_by: z.string().uuid(),
});
```

### 4.3 Module-Specific Schemas (Example)

```typescript
// src/domain/kyc/schemas/IdentityProfileSchema.ts

export const IdentityProfileDataSchema = z.object({
  lei_validation_date: z.string().datetime().optional(),
  lei_code: z.string().length(20).optional(),
  legal_name: z.string().optional(),
  reg_address_line1: z.string().optional(),
  // ... all identity fields
});

export const IdentityProfileWithMetaSchema = z.object({
  data: IdentityProfileDataSchema,
  _meta: MetaSchema,
});
```

---

## 5. Service-Layer Write API Strategy

### 5.1 Integration with Existing Question-Centric Workflow

**Critical Alignment:**
The system already implements process context via the **Question table** (tokenized, one row per question instance).

**Existing Pattern:**
- Question table links: Legal Entity (SPV) + Questionnaire + Bank/FI
- Represents: "This entity answering this question for this bank under this questionnaire"
- Already encodes: per-bank, per-deal, per-run state

**Responsibility Separation:**
- **Legal Entity + Modules** = "What is true" (canonical, reusable entity data)
- **Evidence + Documents** = "Why we believe it"
- **Questions** = "Who asked, in what context, and what is required now"

**No New Process Tables:**
We do NOT introduce an `onboarding_requests` table. The Question table IS the process layer.

---

### 5.2 Core Write Service

```typescript
// src/services/kyc/KycWriteService.ts

class KycWriteService {
  /**
   * Universal write method enforcing provenance invariant
   * Called from Question answer handlers
   */
  async updateField(params: {
    entityId: string;
    fieldNo: number;
    value: unknown;
    evidenceId?: string;
    source: 'GLEIF' | 'COMPANIES_HOUSE' | 'USER_INPUT' | 'SYSTEM';
    userId?: string;
  }): Promise<void> {
    // 1. Lookup field definition
    const fieldDef = getFieldDefinition(params.fieldNo);
    
    // 2. Construct _meta entry
    const metaEntry = {
      field_no: params.fieldNo,
      source: params.source,
      evidence_id: params.evidenceId,
      timestamp: new Date().toISOString(),
      verified_by: params.userId,
    };
    
    // 3. Determine target table/column
    const { table, column, isRepeating } = fieldDef;
    
    // 4. Execute write with _meta update (atomic)
    if (isRepeating) {
      // Handle 1:N table (requires row ID)
      throw new Error('Use updateRepeatingField for 1:N tables');
    } else {
      // Update 1:1 profile
      await this.updateProfileField(entityId, table, column, value, metaEntry);
    }
  }
  
  private async updateProfileField(
    entityId: string,
    table: string,
    column: string,
    value: unknown,
    metaEntry: MetaEntry
  ): Promise<void> {
    // Atomic JSONB merge using raw SQL to avoid race conditions
    // Alternative: Use optimistic locking with version field
    
    // Explicitly cast metaEntry to JSONB (no implicit JS object assumptions)
    const metaJsonb = JSON.stringify({ [column]: metaEntry });
    
    await prisma.$executeRaw`
      INSERT INTO ${table} (legal_entity_id, ${column}, _meta)
      VALUES (
        ${entityId}::uuid,
        ${value},
        ${metaJsonb}::jsonb
      )
      ON CONFLICT (legal_entity_id)
      DO UPDATE SET
        ${column} = EXCLUDED.${column},
        _meta = ${table}._meta || EXCLUDED._meta
    `;
    
    // Concurrency semantics:
    // - Concurrent updates to DIFFERENT keys: merge safely (|| operator)
    // - Concurrent updates to SAME key: last-write-wins (acceptable)
    // - No _meta entries are lost across concurrent field updates
  }
}
```

---

### 5.3 Module Validation (Invoked from Question State Transitions)

**Trigger Points:**
Module validation is called when:
- A Question is marked SUBMITTED
- A Questionnaire section is marked VERIFIED
- A Question state transition requires module completeness

**Integration Pattern:**

```typescript
// src/services/kyc/ModuleValidator.ts

class ModuleValidator {
  /**
   * Validates module completeness for a specific entity
   * Called from Question/Questionnaire state machine
   */
  async validateModule(params: {
    entityId: string;
    moduleName: 'identity' | 'trading_authorisation' | 'tax' | 'compliance' | ...;
  }): Promise<ValidationResult> {
    switch (params.moduleName) {
      case 'trading_authorisation':
        return this.validateTradingAuth(params.entityId);
      case 'tax':
        return this.validateTax(params.entityId);
      // ... other modules
    }
  }
  
  private async validateTradingAuth(entityId: string): Promise<ValidationResult> {
    const traders = await prisma.authorized_traders.findMany({
      where: { legal_entity_id: entityId },
    });
    
    const errors: string[] = [];
    
    for (const trader of traders) {
      // Field 100 gate: at least one of document OR attestation
      if (!trader.authority_document_id && !trader.authority_attestation_text) {
        errors.push(`Trader ${trader.full_name}: Missing proof of authority (Field 100)`);
      }
      
      // Check _meta for Field-No-mapped columns only (scoped to authorized_traders table)
      validateMetaForFields(trader._meta, trader, 'authorized_traders', FIELD_DEFINITIONS);
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

**Invocation from Question State Machine:**

```typescript
// Example: In existing Question state transition handler
async function handleQuestionSubmission(questionId: string): Promise<void> {
  const question = await getQuestion(questionId);
  
  // Determine which module this question belongs to
  const moduleName = mapQuestionToModule(question.field_no);
  
  // Validate module completeness before allowing submission
  const validation = await moduleValidator.validateModule({
    entityId: question.legal_entity_id,
    moduleName,
  });
  
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }
  
  // Proceed with state transition
  await updateQuestionState(questionId, 'SUBMITTED');
}
```

**Key Principle:**
- Module validation is **callable** from Question/Questionnaire logic
- It does NOT duplicate process state
- It validates "what is true" against "what is required" at the appropriate gate

---

### 5.4 Document Upload Service

```typescript
// src/services/kyc/DocumentService.ts

class DocumentService {
  async uploadDocument(params: {
    legalEntityId: string;
    ownerType: 'LEGAL_ENTITY' | 'STAKEHOLDER' | 'AUTHORIZED_TRADER';
    ownerId: string;
    fieldNo: number;
    file: File;
    uploadedBy: string;
  }): Promise<Document> {
    // 1. Upload to S3
    const filePath = await this.s3Upload(params.file);
    
    // 2. Create document registry entry
    const doc = await prisma.document_registry.create({
      data: {
        legal_entity_id: params.legalEntityId,
        owner_type: params.ownerType,
        owner_id: params.ownerId,
        field_no: params.fieldNo,
        file_path: filePath,
        file_name: params.file.name,
        mime_type: params.file.type,
        uploaded_by: params.uploadedBy,
      },
    });
    
    // 3. If owner is authorized_trader and fieldNo is 100, link it
    if (params.ownerType === 'AUTHORIZED_TRADER' && params.fieldNo === 100) {
      await prisma.authorized_traders.update({
        where: { id: params.ownerId },
        data: { authority_document_id: doc.id },
      });
    }
    
    return doc;
  }
}
```

---

## 6. Implementation Phases

### Phase 2A: Schema & Migrations (Week 1)
- Define Prisma schema for all 21 tables
- Generate migrations
- Test migration rollback

### Phase 2B: Type Safety Layer (Week 1-2)
- Implement `FieldDefinitions.ts` covering all active canonical Field Nos (excluding placeholder 94)
- Implement Zod schemas for `_meta`, `document_registry`, and all modules
- Write unit tests for schema validation

### Phase 2C: Service Layer (Week 2-3)
- Implement `KycWriteService` with provenance enforcement
- Implement `WorkflowValidator` with gate logic
- Implement `DocumentService` with polymorphic linking
- Write integration tests

### Phase 2D: Data Migration (Week 3-4)
- Map existing `ClientLE` data to new schema
- Backfill `_meta` for migrated data (source: `SYSTEM`, evidence: migration audit)
- Verify data integrity

### Phase 2E: API Layer (Week 4-5)
- Expose Next.js API routes for CRUD operations
- Integrate with existing UI components
- End-to-end testing

---

## 7. Risk Mitigation

### Risk: Prisma Dynamic Table Access
**Issue**: `prisma[table]` is not type-safe.
**Mitigation**: Use a typed table registry with explicit model mappings.

### Risk: JSONB `_meta` Merge Conflicts
**Issue**: Concurrent updates to `_meta` may overwrite entries.
**Mitigation**: Use Prisma's `JsonValue` merge strategy or implement optimistic locking.

### Risk: Field 100 Validation Bypass
**Issue**: Developers may forget to call `ModuleValidator`.
**Mitigation**: Enforce validation in existing Question state machine transitions (e.g., before SUBMITTED/VERIFIED state changes).

### Risk: Duplicate Process State
**Issue**: Introducing new process tables that duplicate existing Question functionality.
**Mitigation**: **RESOLVED** - No new process tables. Module validation integrates with existing Question/Questionnaire workflow.

---

**Status**: Ready for Phase 2A execution upon approval.

---

## 8. Confirmation: No Duplicate Process State

**What We Are NOT Building:**
- ❌ A new `onboarding_requests` table
- ❌ A separate "module completion" tracking system
- ❌ Duplicate workflow state management

**What We ARE Building:**
- ✅ Canonical entity data modules (Legal Entity + Profiles)
- ✅ Evidence and document provenance infrastructure
- ✅ Module validation services **callable from** existing Question logic
- ✅ Hard provenance invariants enforced at write time

**Integration Summary:**
```
Question State Transition (existing)
  ↓
  calls ModuleValidator.validateModule()
  ↓
  validates Legal Entity + Module data
  ↓
  returns ValidationResult
  ↓
Question proceeds or blocks (existing logic)
```

The Phase 2 implementation adds **data infrastructure** and **validation services**, but does NOT replace or duplicate the existing Question-centric workflow.
