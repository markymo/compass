import { FieldCandidate } from "./types";

/**
 * Pure function to map raw GLEIF JSON payload to canonical Field Candidates.
 * Does NOT perform any database lookups or writes.
 */
export function mapGleifPayloadToFieldCandidates(payload: any, evidenceId: string): FieldCandidate[] {
    const candidates: FieldCandidate[] = [];

    // Safety check for payload structure (GLEIF API 2.0 structure assumed)
    // Structure: data: { attributes: { ... } } or just attributes: { ... } depending on storage
    // We assume the stored payload is the full JSON response or the 'data' object.
    // Let's assume standard GLEIF API structure where 'attributes' is the key.

    // Normalize access to attributes
    const attr = payload.data?.attributes || payload.attributes || payload;

    if (!attr) return [];

    // --- Identity Profile ---

    // Field 2: LEI
    if (attr.lei) {
        candidates.push({
            fieldNo: 2,
            value: attr.lei,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    // Field 3: Legal Name
    if (attr.entity?.legalName?.name) {
        candidates.push({
            fieldNo: 3,
            value: attr.entity.legalName.name,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    // Field 6: Registered Address Line 1 (Usually legalAddress)
    if (attr.entity?.legalAddress?.addressLines?.[0]) {
        candidates.push({
            fieldNo: 6,
            value: attr.entity.legalAddress.addressLines[0],
            source: 'GLEIF',
            evidenceId,
            confidence: 0.9
        });
    }

    // Field 7: Registered Address City
    if (attr.entity?.legalAddress?.city) {
        candidates.push({
            fieldNo: 7,
            value: attr.entity.legalAddress.city,
            source: 'GLEIF',
            evidenceId,
            confidence: 0.9
        });
    }

    // Field 8: Registered Address Region
    if (attr.entity?.legalAddress?.region) {
        candidates.push({
            fieldNo: 8,
            value: attr.entity.legalAddress.region,
            source: 'GLEIF',
            evidenceId,
            confidence: 0.9
        });
    }

    // Field 9: Registered Address Country
    if (attr.entity?.legalAddress?.country) {
        candidates.push({
            fieldNo: 9,
            value: attr.entity.legalAddress.country,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    // Field 10: Registered Address Postcode
    if (attr.entity?.legalAddress?.postalCode) {
        candidates.push({
            fieldNo: 10,
            value: attr.entity.legalAddress.postalCode,
            source: 'GLEIF',
            evidenceId,
            confidence: 0.9
        });
    }

    // Field 11: Entity Status
    if (attr.entity?.status) {
        candidates.push({
            fieldNo: 26, // Mapped to 26 in FieldDefinitions.ts (Entity Status) - Wait, previous logic was 11. Let me check definitions again. 
            // Checking definition: 26 is "Entity status", 11 is "Headquarters address line 1".
            // Correction: Field 26 is Entity Status in FieldDefinitions.ts.
            // My previous manual mapping in DataSchemaTab might have been wrong or assumed old schema.
            // Following FieldDefinitions.ts strictly.
            value: attr.entity.status,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    // Field 19: GLEIF Entity Category
    if (attr.entity?.category) {
        candidates.push({
            fieldNo: 19,
            value: attr.entity.category,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    // Field 27: Entity Creation Date (Incorporation Date)
    if (attr.entity?.creationDate) {
        candidates.push({
            fieldNo: 27, // FieldDefinitions says 27 is "Entity creation date". 
            // In DataSchemaTab we used 6 for Incorporation Date. FieldDefinitions says 6 is "Registered address line 1".
            // THIS IS A MAJOR DISCREPANCY.
            // I must trust FieldDefinitions.ts as the source of truth.
            value: attr.entity.creationDate,
            source: 'GLEIF',
            evidenceId,
            confidence: 1.0
        });
    }

    return candidates;
}
