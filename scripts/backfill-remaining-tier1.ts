/**
 * backfill-remaining-tier1.ts
 * 
 * One-off migration script to backfill FieldClaim records from legacy Tier 1
 * profile tables that were missed by the original master-data-backfill.js.
 * 
 * Tables covered:
 *   - EntityInfoProfile  → Fields 19, 21-25
 *   - LeiRegistration    → Fields 28-35
 *   - RelationshipProfile → Fields 36-55
 *   - ConstitutionalProfile → Fields 16-18
 * 
 * Usage: npx tsx scripts/backfill-remaining-tier1.ts [--dry-run]
 */

import { PrismaClient, SourceType, ClaimStatus } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

type FieldMapping = { field: string; fieldNo: number };

// ── EntityInfoProfile (Fields 19, 21-25) ─────────────────────────────────
const ENTITY_INFO_MAPPINGS: FieldMapping[] = [
    { field: 'gleifEntityCategory', fieldNo: 19 },
    { field: 'entityLegalFormCode', fieldNo: 21 },
    { field: 'countryOfFormation', fieldNo: 22 },
    { field: 'countryCode', fieldNo: 23 },
    { field: 'entityLegalFormLocalName', fieldNo: 24 },
    { field: 'entityLegalFormTransliteratedName', fieldNo: 25 },
];

// ── LeiRegistration (Fields 28-35) ───────────────────────────────────────
const LEI_REGISTRATION_MAPPINGS: FieldMapping[] = [
    { field: 'leiRegistrationDate', fieldNo: 28 },
    { field: 'leiRegistrationUpdateDate', fieldNo: 29 },
    { field: 'leiRegistrationStatus', fieldNo: 30 },
    { field: 'leiRegistrationNextRenewal', fieldNo: 31 },
    { field: 'leiIssuerLei', fieldNo: 32 },
    { field: 'leiIssuer', fieldNo: 33 },
    { field: 'leiCorroborationLevel', fieldNo: 34 },
    { field: 'leiCorroborationSource', fieldNo: 35 },
];

// ── RelationshipProfile (Fields 36-55) ───────────────────────────────────
const RELATIONSHIP_MAPPINGS: FieldMapping[] = [
    { field: 'directParentId', fieldNo: 36 },
    { field: 'directParent', fieldNo: 37 },
    { field: 'directParentIdType', fieldNo: 38 },
    { field: 'directParentRelationship', fieldNo: 39 },
    { field: 'ultimateParentId', fieldNo: 40 },
    { field: 'ultimateParent', fieldNo: 41 },
    { field: 'ultimateParentIdType', fieldNo: 42 },
    { field: 'ultimateParentRelationship', fieldNo: 43 },
    { field: 'fundManagerId', fieldNo: 44 },
    { field: 'fundManager', fieldNo: 45 },
    { field: 'fundManagerIdType', fieldNo: 46 },
    { field: 'fundManagerRelationship', fieldNo: 47 },
    { field: 'fundManagerRelationshipStatus', fieldNo: 48 },
    { field: 'umbrellaFundId', fieldNo: 49 },
    { field: 'umbrellaFund', fieldNo: 50 },
    { field: 'umbrellaFundIdType', fieldNo: 51 },
    { field: 'umbrellaFundRelationship', fieldNo: 52 },
    { field: 'umbrellaFundRelationshipStatus', fieldNo: 53 },
    { field: 'leiDirectParentException', fieldNo: 54 },
    { field: 'leiUltimateParentException', fieldNo: 55 },
];

// ── ConstitutionalProfile (Fields 16-18) ─────────────────────────────────
const CONSTITUTIONAL_MAPPINGS: FieldMapping[] = [
    { field: 'registrationAuthorityGleifId', fieldNo: 16 },
    { field: 'registrationAuthority', fieldNo: 17 },
    { field: 'registeredNumber', fieldNo: 18 },
];

// ── Generic backfill for 1:1 profile tables ──────────────────────────────
async function backfillOneToOne(
    modelName: string,
    mappings: FieldMapping[],
    fetchAll: () => Promise<any[]>
) {
    const records = await fetchAll();
    console.log(`\n📦 ${modelName}: ${records.length} records`);

    let created = 0;
    let skipped = 0;

    for (const record of records) {
        const leId = record.legalEntityId;
        if (!leId) { skipped++; continue; }

        // Extract provenance from meta JSON if available
        const meta = (record.meta && typeof record.meta === 'object') ? record.meta : {};

        for (const mapping of mappings) {
            const val = record[mapping.field];
            if (val === null || val === undefined) continue;

            // Check if a claim already exists for this field + subject
            const existing = await prisma.fieldClaim.findFirst({
                where: {
                    fieldNo: mapping.fieldNo,
                    subjectLeId: leId,
                },
            });

            if (existing) {
                skipped++;
                continue;
            }

            // Try to extract provenance from meta
            const fieldMeta = meta[mapping.field] || {};
            const evidenceId = fieldMeta.evidence_id || null;
            const sourceType = fieldMeta.source === 'GLEIF' ? SourceType.GLEIF
                : fieldMeta.source === 'COMPANIES_HOUSE' ? SourceType.COMPANIES_HOUSE
                    : SourceType.SYSTEM_DERIVED;

            const claimData: any = {
                fieldNo: mapping.fieldNo,
                subjectLeId: leId,
                sourceType,
                status: ClaimStatus.VERIFIED,
                assertedAt: record.updatedAt || record.createdAt || new Date(),
                confidenceScore: fieldMeta.confidence ?? 1.0,
            };

            // Set evidence link if available
            if (evidenceId) {
                // Verify evidence exists before linking
                const evidenceExists = await prisma.evidenceStore.findUnique({
                    where: { id: evidenceId },
                    select: { id: true },
                });
                if (evidenceExists) {
                    claimData.evidenceId = evidenceId;
                }
            }

            // Set the appropriate value column
            if (val instanceof Date) {
                claimData.valueDate = val;
            } else if (typeof val === 'number') {
                claimData.valueNumber = val;
            } else if (typeof val === 'object') {
                claimData.valueJson = val;
            } else {
                claimData.valueText = String(val);
            }

            if (isDryRun) {
                console.log(`  [DRY RUN] Would create claim: Field ${mapping.fieldNo} (${mapping.field}) = ${JSON.stringify(val)} for LE ${leId}`);
            } else {
                await prisma.fieldClaim.create({ data: claimData });
            }
            created++;
        }
    }

    console.log(`  ✅ Created: ${created}, Skipped: ${skipped}`);
    return created;
}

async function main() {
    console.log(`🚀 Tier 1 Remaining Backfill ${isDryRun ? '(DRY RUN)' : '(LIVE)'}`);
    console.log('═'.repeat(60));

    let totalCreated = 0;

    // 1. EntityInfoProfile
    totalCreated += await backfillOneToOne(
        'EntityInfoProfile',
        ENTITY_INFO_MAPPINGS,
        () => (prisma as any).entityInfoProfile.findMany()
    );

    // 2. LeiRegistration
    totalCreated += await backfillOneToOne(
        'LeiRegistration',
        LEI_REGISTRATION_MAPPINGS,
        () => (prisma as any).leiRegistration.findMany()
    );

    // 3. RelationshipProfile
    totalCreated += await backfillOneToOne(
        'RelationshipProfile',
        RELATIONSHIP_MAPPINGS,
        () => (prisma as any).relationshipProfile.findMany()
    );

    // 4. ConstitutionalProfile
    totalCreated += await backfillOneToOne(
        'ConstitutionalProfile',
        CONSTITUTIONAL_MAPPINGS,
        () => (prisma as any).constitutionalProfile.findMany()
    );

    console.log('\n' + '═'.repeat(60));
    console.log(`🏁 Backfill complete. Total FieldClaims created: ${totalCreated}`);
}

main()
    .catch(e => { console.error('❌ Backfill failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
