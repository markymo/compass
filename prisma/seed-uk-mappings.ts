import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUKMappings() {
    const RA_IDS = ['RA000585', 'RA000586', 'RA000587']; // UK Companies House variants

    console.log(`[Seed] Bootstrapping Mapping Pack for UK Companies House variants...`);
    console.log(`[Seed] Strategy: upsert-only (additive/idempotent). No rows will be deleted.`);

    const mappings = [
        // CORE ATTRIBUTES (from COMPANY_PROFILE payload)
        {
            sourcePath: 'company_name',
            targetFieldNo: 3, // Legal Name
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Primary Name'
        },
        {
            sourcePath: 'date_of_creation',
            targetFieldNo: 27, // Incorporation Date
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            transformType: 'DATE_TO_ISO',
            notes: 'UK Incorporation Date'
        },
        {
            sourcePath: 'company_status',
            targetFieldNo: 26, // Entity Status
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Status Code'
        },
        {
            sourcePath: 'registered_office_address.address_line_1',
            targetFieldNo: 6, // Address Line 1
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Registered Office'
        },
        {
            sourcePath: 'registered_office_address.locality',
            targetFieldNo: 7, // City
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Locality'
        },
        {
            sourcePath: 'registered_office_address.postal_code',
            targetFieldNo: 10, // Postcode
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Postcode'
        },

        // JURISDICTION SPECIFIC (from COMPANY_PROFILE)
        {
            sourcePath: 'type',
            targetFieldNo: 19, // Entity Category / Type
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Company Type (ltd, plc, etc.)'
        },
        {
            sourcePath: 'jurisdiction',
            targetFieldNo: 9, // Country
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            notes: 'UK Registration Jurisdiction'
        },

        // PREVIOUS LEGAL NAMES (Field 5 — isMultiValue: true)
        // Companies House API returns previous_names as an array of objects:
        // [{ name: "Old Name Ltd", ceased_on: "2020-01-01" }]
        // The DIRECT transform's smart extraction pulls `.name` from each object,
        // returning an array of strings. KycWriteService handles array iteration for
        // repeating fields and auto-generates rowIds.
        {
            sourcePath: 'previous_names',
            targetFieldNo: 5, // Previous Legal Names
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            transformType: 'DIRECT',
            notes: 'UK Previous Legal Names (array of objects; DIRECT extracts .name from each)'
        },
    ];

    let created = 0;
    let updated = 0;
    let alreadyExisting = 0;

    for (const RA_ID of RA_IDS) {
        for (const m of mappings) {
            const whereKey = {
                sourceType_sourceReference_mappingScope_payloadSubtype_sourcePath_targetFieldNo: {
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: RA_ID,
                    mappingScope: m.mappingScope,
                    payloadSubtype: m.payloadSubtype,
                    sourcePath: m.sourcePath,
                    targetFieldNo: m.targetFieldNo
                }
            };

            // Check whether the row exists before upserting so we can accurately report
            const existing = await (prisma as any).sourceFieldMapping.findUnique({ where: whereKey });

            await (prisma as any).sourceFieldMapping.upsert({
                where: whereKey,
                update: {
                    isActive: true,
                    transformType: (m as any).transformType || 'DIRECT',
                    notes: m.notes
                },
                create: {
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: RA_ID,
                    mappingScope: m.mappingScope,
                    payloadSubtype: m.payloadSubtype,
                    sourcePath: m.sourcePath,
                    targetFieldNo: m.targetFieldNo,
                    isActive: true,
                    transformType: (m as any).transformType || 'DIRECT',
                    notes: m.notes,
                    priority: 10
                }
            });

            if (!existing) {
                created++;
                console.log(`  [CREATED] ${RA_ID} | F${m.targetFieldNo} | ${m.sourcePath}`);
            } else {
                const transformChanged = existing.transformType !== ((m as any).transformType || 'DIRECT');
                const notesChanged = existing.notes !== m.notes;
                if (transformChanged || notesChanged) {
                    updated++;
                    console.log(`  [UPDATED] ${RA_ID} | F${m.targetFieldNo} | ${m.sourcePath}`);
                } else {
                    alreadyExisting++;
                    console.log(`  [EXISTS]  ${RA_ID} | F${m.targetFieldNo} | ${m.sourcePath}`);
                }
            }
        }
    }

    console.log(`\n[Seed] Complete.`);
    console.log(`  Created:          ${created} new rows`);
    console.log(`  Updated:          ${updated} rows (metadata only)`);
    console.log(`  Already current:  ${alreadyExisting} rows (no change)`);
    console.log(`  Total processed:  ${created + updated + alreadyExisting}`);
    console.log(`\n[Seed] Verification: run the following to confirm row counts:`);
    console.log(`  SELECT "sourceType", "sourceReference", COUNT(*) FROM source_field_mappings GROUP BY 1, 2 ORDER BY 1, 2;`);
}


seedUKMappings()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
