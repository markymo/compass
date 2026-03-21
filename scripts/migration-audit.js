
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStrandedData() {
    console.log("=== DATA LOSS ANALYSIS: ROW COUNT AUDIT ===\n");

    const checks = [
        { model: 'identityProfile', fields: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 26, 27] },
        { model: 'authorizedTrader', fields: [96, 97, 98, 99, 100, 101] },
        { model: 'stakeholder', fields: [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73] }
    ];

    for (const check of checks) {
        const legacyCount = await prisma[check.model].count();

        // Sum of all claims for any field in this model's mapping
        // (This is a rough proxy, as one legacy row usually maps to multiple field claims)
        const claimCount = await prisma.fieldClaim.count({
            where: { fieldNo: { in: check.fields } }
        });

        console.log(`Model: ${check.model}`);
        console.log(`  Legacy Rows: ${legacyCount}`);
        console.log(`  Related Claims: ${claimCount}`);

        if (legacyCount > 0 && claimCount === 0) {
            console.warn(`  [CRITICAL] Data in ${check.model} exists but NO claims found!`);
        } else if (legacyCount > 0 && claimCount < legacyCount) {
            console.warn(`  [CAUTION] Claim count (${claimCount}) is less than legacy rows (${legacyCount})? Check redundancy.`);
        } else {
            console.log(`  [OK] Data coverage seems present.`);
        }
    }
}

checkStrandedData()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
