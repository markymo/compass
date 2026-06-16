/**
 * seed-field-63-migration.ts
 *
 * Idempotent script to migrate Field 63 (List of company directors) configuration:
 * 1. Update MasterFieldDefinition for fieldNo 63 to appDataType 'PARTY'.
 * 2. Deactivate the MasterFieldGraphBinding for fieldNo 63 (isActive = false).
 * 3. Deactivate the legacy BASELINE SourceFieldMapping for field 63.
 * 4. Create/update RAW_PAYLOAD SourceFieldMapping for Companies House (COMPANIES_HOUSE and RA000586).
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-field-63-migration.ts
 */

import { PrismaClient, SourceType, MappingScope } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('[seed-field-63-migration] Starting field 63 database configuration migration...\n');

    // 1. Update MasterFieldDefinition appDataType to PARTY
    const fieldDefUpdate = await (prisma as any).masterFieldDefinition.updateMany({
        where: { fieldNo: 63 },
        data: {
            appDataType: 'PARTY',
            notes: 'List of company directors stored as embedded PartyValue structures with roles[].'
        }
    });
    console.log(`[MasterFieldDefinition] Updated ${fieldDefUpdate.count} definition(s) for Field 63.`);

    // 2. Deactivate MasterFieldGraphBinding for Field 63
    const graphBindingUpdate = await (prisma as any).masterFieldGraphBinding.updateMany({
        where: { fieldNo: 63, isActive: true },
        data: { isActive: false }
    });
    console.log(`[MasterFieldGraphBinding] Deactivated ${graphBindingUpdate.count} active binding(s) for Field 63.`);

    // 3. Deactivate legacy BASELINE mapping for Field 63
    const legacyMappingUpdate = await (prisma as any).sourceFieldMapping.updateMany({
        where: {
            targetFieldNo: 63,
            mappingScope: MappingScope.BASELINE,
            isActive: true
        },
        data: { isActive: false, notes: 'Deactivated in favor of RAW_PAYLOAD PARTY mapping.' }
    });
    console.log(`[SourceFieldMapping] Deactivated ${legacyMappingUpdate.count} legacy BASELINE mapping(s) for Field 63.`);

    // 4. Create or update RAW_PAYLOAD mappings for Companies House
    const includeRolesFilter = {
        includeRoles: [
            { roleType: "director", isActiveRole: true }
        ]
    };

    const transformConfig = {
        fullNamePath: "name",
        roleTitlePath: "officer_role",
        appointedOnPath: "appointed_on",
        resignedOnPath: "resigned_on",
        dobYearPath: "date_of_birth.year",
        dobMonthPath: "date_of_birth.month",
        nationalityPath: "nationality",
        countryOfResidencePath: "country_of_residence",
        sourceIdentifiers: [
            {
                scheme: "COMPANIES_HOUSE_PERSON_NUMBER",
                valuePath: "person_number"
            }
        ]
    };

    const targetSourceRefs = ['COMPANIES_HOUSE', 'RA000586'];

    for (const sourceRef of targetSourceRefs) {
        const whereKey = {
            sourceType_sourceReference_mappingScope_payloadSubtype_sourcePath_targetFieldNo: {
                sourceType: SourceType.REGISTRATION_AUTHORITY,
                sourceReference: sourceRef,
                mappingScope: MappingScope.RAW_PAYLOAD,
                payloadSubtype: 'OFFICERS',
                sourcePath: '$',
                targetFieldNo: 63
            }
        };

        const existing = await (prisma as any).sourceFieldMapping.findUnique({ where: whereKey });

        await (prisma as any).sourceFieldMapping.upsert({
            where: whereKey,
            update: {
                isActive: true,
                transformType: 'TO_PARTY_VALUE_LIST',
                transformConfig: transformConfig,
                syncMode: 'SNAPSHOT_SYNC',
                filterConfig: includeRolesFilter,
                notes: `CH Officers to Field 63 (PARTY). Migrated 2026-06-14.`
            },
            create: {
                sourceType: SourceType.REGISTRATION_AUTHORITY,
                sourceReference: sourceRef,
                mappingScope: MappingScope.RAW_PAYLOAD,
                payloadSubtype: 'OFFICERS',
                sourcePath: '$',
                targetFieldNo: 63,
                isActive: true,
                transformType: 'TO_PARTY_VALUE_LIST',
                transformConfig: transformConfig,
                syncMode: 'SNAPSHOT_SYNC',
                filterConfig: includeRolesFilter,
                priority: 10,
                notes: `CH Officers to Field 63 (PARTY). Migrated 2026-06-14.`
            }
        });

        if (existing) {
            console.log(`[SourceFieldMapping] Upserted (Updated) mapping for sourceReference: ${sourceRef}`);
        } else {
            console.log(`[SourceFieldMapping] Upserted (Created) mapping for sourceReference: ${sourceRef}`);
        }
    }

    console.log('\n[Verification]\n');
    const verifyMappings = await (prisma as any).sourceFieldMapping.findMany({
        where: { targetFieldNo: 63 },
        select: {
            id: true,
            sourceReference: true,
            mappingScope: true,
            payloadSubtype: true,
            transformType: true,
            syncMode: true,
            filterConfig: true,
            isActive: true
        }
    });
    console.log('Current Field 63 SourceFieldMappings in DB:');
    console.log(JSON.stringify(verifyMappings, null, 2));

    const verifyBindings = await (prisma as any).masterFieldGraphBinding.findMany({
        where: { fieldNo: 63 },
        select: { id: true, fieldNo: true, isActive: true }
    });
    console.log('\nCurrent Field 63 MasterFieldGraphBindings in DB:');
    console.log(JSON.stringify(verifyBindings, null, 2));

    const verifyDef = await (prisma as any).masterFieldDefinition.findFirst({
        where: { fieldNo: 63 },
        select: { fieldNo: true, appDataType: true }
    });
    console.log('\nCurrent Field 63 MasterFieldDefinition in DB:');
    console.log(JSON.stringify(verifyDef, null, 2));

    console.log('\n[seed-field-63-migration] Done.');
}

main()
    .catch(e => {
        console.error('[seed-field-63-migration] ERROR:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
