
const { PrismaClient } = require('@prisma/client');
const { KycLoader } = require('../src/services/kyc/KycLoader');
const { FIELD_DEFINITIONS } = require('../src/domain/kyc/FieldDefinitions');

const prisma = new PrismaClient();
const kycLoader = new KycLoader();

async function runAudit(legalEntityId) {
    console.log(`\n=== SEMANTIC AUDIT (CJS): ${legalEntityId} ===`);

    let totalFields = 0;
    let mismatches = 0;

    const redundantModels = [
        'IdentityProfile', 'EntityInfoProfile', 'LeiRegistration',
        'RelationshipProfile', 'ConstitutionalProfile', 'ComplianceProfile',
        'TaxProfile', 'FinancialProfile', 'DerivativesProfile',
        'TradingProfile', 'ContactProfile'
    ];

    const fieldsToVerify = Object.values(FIELD_DEFINITIONS).filter(d =>
        redundantModels.includes(d.model) && d.field && !d.isRepeating
    );

    for (const def of fieldsToVerify) {
        totalFields++;

        try {
            const modernResult = await kycLoader.loadField(legalEntityId, def.fieldNo);
            const modernValue = modernResult?.value;

            const modelKey = def.model.charAt(0).toLowerCase() + def.model.slice(1);
            const delegate = prisma[modelKey];
            if (!delegate) {
                console.warn(`[WARN] No delegate found for model ${def.model}`);
                continue;
            }

            const legacyRecord = await delegate.findUnique({
                where: { legalEntityId }
            });
            const legacyValue = legacyRecord?.[def.field];

            const isMatch = compareValues(modernValue, legacyValue);

            if (!isMatch) {
                mismatches++;
                console.error(`[MISMATCH] Field ${def.fieldNo} (${def.fieldName}):`);
                console.error(`  Modern: ${JSON.stringify(modernValue)}`);
                console.error(`  Legacy: ${JSON.stringify(legacyValue)}`);
            }
        } catch (err) {
            console.error(`[ERROR] Failed to verify field ${def.fieldNo}: ${err.message}`);
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

function compareValues(a, b) {
    if (a === b) return true;
    if (!a && !b) return true;
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    return String(a) === String(b);
}

const leId = process.argv[2];
if (!leId) {
    console.error("Please provide a LegalEntityId.");
    process.exit(1);
}

runAudit(leId)
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
