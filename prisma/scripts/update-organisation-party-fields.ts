/**
 * update-organisation-party-fields.ts
 *
 * Maintenance script to update database MasterFieldDefinition rows for Field 37 & 41:
 *  - appDataType: 'PARTY'
 *  - profileConfig: { allowedPartyTypes: ['ORGANISATION'], displayMask: [...] }
 *
 * Supports --dry-run flag.
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/update-organisation-party-fields.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log(`[update-organisation-party-fields] Starting update (dryRun=${isDryRun})...\n`);

    const fieldsToUpdate = [37, 41];
    const newProfileConfig = {
        allowedPartyTypes: ['ORGANISATION'],
        displayMask: [
            'organisation.legalName',
            'organisation.registrationNumber',
            'organisation.incorporatedIn',
            'organisation.lei'
        ]
    };

    for (const fieldNo of fieldsToUpdate) {
        const existing = await (prisma as any).masterFieldDefinition.findUnique({
            where: { fieldNo }
        });

        if (!existing) {
            console.warn(`[MasterFieldDefinition] Field ${fieldNo} not found in DB.`);
            continue;
        }

        const existingProfile = existing.profileConfig as Record<string, any> || {};
        const updatedProfile = {
            ...existingProfile,
            ...newProfileConfig
        };

        console.log(`Field ${fieldNo} (${existing.fieldName}):`);
        console.log(`  Current appDataType: ${existing.appDataType}`);
        console.log(`  Current profileConfig:`, JSON.stringify(existingProfile));
        console.log(`  Target appDataType: PARTY`);
        console.log(`  Target profileConfig:`, JSON.stringify(updatedProfile));

        if (!isDryRun) {
            await (prisma as any).masterFieldDefinition.update({
                where: { fieldNo },
                data: {
                    appDataType: 'PARTY',
                    profileConfig: updatedProfile
                }
            });
            console.log(`  -> Field ${fieldNo} updated successfully.\n`);
        } else {
            console.log(`  -> [DRY RUN] Skipping actual DB write for Field ${fieldNo}.\n`);
        }
    }

    console.log(`[update-organisation-party-fields] Completed.`);
}

main()
    .catch((e) => {
        console.error('Fatal error running update-organisation-party-fields:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
