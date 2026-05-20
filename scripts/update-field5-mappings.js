#!/usr/bin/env node
/**
 * update-field5-mappings.js
 * 
 * Run: node scripts/update-field5-mappings.js
 * 
 * Updates the two existing RA source mappings for Field 5 from DIRECT
 * to TO_NAME_HISTORY_LIST, now that the enum value is in the DB.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const result = await p.sourceFieldMapping.updateMany({
        where: {
            targetFieldNo: 5,
            sourceType: 'REGISTRATION_AUTHORITY',
            // Only update the DIRECT ones (don't touch GLEIF DIRECT intentionally)
        },
        data: {
            transformType: 'TO_NAME_HISTORY_LIST',
            notes: 'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_names in COMPANY_PROFILE payload.'
        }
    });
    console.log(`✅ Updated ${result.count} CH source mappings to TO_NAME_HISTORY_LIST`);

    // Also update GLEIF to use TO_NAME_HISTORY_LIST
    const gleif = await p.sourceFieldMapping.updateMany({
        where: {
            targetFieldNo: 5,
            sourceType: 'GLEIF',
        },
        data: {
            transformType: 'TO_NAME_HISTORY_LIST',
            notes: 'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.'
        }
    });
    console.log(`✅ Updated ${gleif.count} GLEIF source mappings to TO_NAME_HISTORY_LIST`);

    // Report final state
    const all = await p.sourceFieldMapping.findMany({
        where: { targetFieldNo: 5 },
        select: { sourceType: true, sourcePath: true, transformType: true, notes: true, isActive: true }
    });
    console.log('\nFinal Field 5 source mappings:');
    all.forEach(m => console.log(` - [${m.sourceType}] ${m.sourcePath} → ${m.transformType} (active: ${m.isActive})`));
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
}).finally(() => p.$disconnect());
