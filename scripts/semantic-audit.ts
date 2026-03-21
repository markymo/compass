
import { PrismaClient } from '@prisma/client';
import { KycLoader } from '../src/services/kyc/KycLoader';
import { FIELD_DEFINITIONS } from '../src/domain/kyc/FieldDefinitions';

// Note: This script uses a raw PrismaClient to bypass the legacyAuditExtension
const prisma = new PrismaClient();
const kycLoader = new KycLoader();

async function runAudit(legalEntityId: string) {
    console.log(`\n=== SEMANTIC AUDIT: ${legalEntityId} ===`);

    let totalFields = 0;
    let mismatches = 0;

    // Filter to fields that mapped to one of the 19 redundant models
    const redundantModels = [
        'IdentityProfile', 'EntityInfoProfile', 'LeiRegistration',
        'RelationshipProfile', 'ConstitutionalProfile', 'ComplianceProfile',
        'TaxProfile', 'FinancialProfile', 'DerivativesProfile',
        'TradingProfile', 'ContactProfile', 'Stakeholder'
    ];

    const fieldsToVerify = Object.values(FIELD_DEFINITIONS).filter(d =>
        redundantModels.includes(d.model) && d.field
    );

    // Specifically check repeating groups like Stakeholders (62+)
    const stakeholderFields = [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73];
    // Add them if not already in redundantModels (Stakeholder model is usually included)

    for (const def of fieldsToVerify) {
        totalFields++;

        // 1. Fetch from Modern Data Layer (FieldClaims)
        const modernResult = await kycLoader.loadField(legalEntityId, def.fieldNo);
        const modernValue = modernResult?.value;

        // 2. Fetch from Legacy Table Directly
        const modelKey = def.model.charAt(0).toLowerCase() + def.model.slice(1);
        const delegate = (prisma as any)[modelKey];

        let legacyValue: any;
        if (def.isRepeating || def.isMultiValue) {
            const legacyRecords = await delegate.findMany({
                where: { legalEntityId }
            });
            legacyValue = legacyRecords.map((r: any) => r[def.field!]).filter(Boolean).sort().join(", ");
        } else {
            const legacyRecord = await delegate.findUnique({
                where: { legalEntityId }
            });
            legacyValue = legacyRecord?.[def.field!];
        }

        // 3. Compare (KycLoader.ts joins modern values with ", " by default for repeating fields)
        const isMatch = compareValues(modernValue, legacyValue);

        if (!isMatch) {
            mismatches++;
            console.error(`[MISMATCH] Field ${def.fieldNo} (${def.fieldName}):`);
            console.error(`  Modern: ${JSON.stringify(modernValue)}`);
            console.error(`  Legacy: ${JSON.stringify(legacyValue)}`);
        }
    }

    console.log(`\nAudit Summary:`);
    console.log(`Fields Verified: ${totalFields}`);
    console.log(`Mismatches: ${mismatches}`);
    if (mismatches === 0) {
        console.log(`RESULT: PASS - No semantic drift detected.`);
    } else {
        console.log(`RESULT: FAIL - ${mismatches} fields differ.`);
    }
}

function compareValues(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a && !b) return true; // Handle null vs undefined

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }

    // Loose string/number comparison if types differ but values are semantically same
    return String(a) === String(b);
}

// Get entity ID from args
const leId = process.argv[2];
if (!leId) {
    console.error("Please provide a LegalEntityId as the first argument.");
    process.exit(1);
}

runAudit(leId)
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
