import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUKMappings() {
    console.log(`[Seed] Bootstrapping Mapping Pack for UK Companies House (canonical sourceReference: COMPANIES_HOUSE)...`);
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
        {
            sourcePath: 'previous_company_names',
            targetFieldNo: 5, // Previous Legal Names
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'COMPANY_PROFILE',
            transformType: 'TO_NAME_HISTORY_LIST',
            syncMode: 'SNAPSHOT_SYNC',
            priority: 100,
            notes: 'UK Previous Legal Names (array of objects; TO_NAME_HISTORY_LIST extracts name and date range from each)'
        },

        // PERSONS WITH SIGNIFICANT CONTROL (Field 64 — isMultiValue: true)
        {
            sourcePath: '$',
            targetFieldNo: 64, // Persons with Significant Control
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'PSC',
            transformType: 'TO_PARTY_VALUE_LIST',
            transformConfig: {
                fullNamePath: 'name',
                roleTitlePath: 'kind',
                appointedOnPath: 'notified_on',
                resignedOnPath: 'ceased_on',
                natureOfControlPath: 'natures_of_control',
                nationalityPath: 'nationality',
                countryOfResidencePath: 'country_of_residence',
                dobYearPath: 'date_of_birth.year',
                dobMonthPath: 'date_of_birth.month',
                sourceIdentifiers: [
                    {
                        scheme: 'COMPANIES_HOUSE_PERSON_NUMBER',
                        valuePath: 'person_number'
                    }
                ]
            },
            filterConfig: {
                includeRoles: [
                    { isActiveRole: true }
                ]
            },
            notes: 'UK Persons with Significant Control (active filter + natures_of_control)'
        }
    ];

    const ALL_MAPPING_SOURCE_KEYS = ['COMPANIES_HOUSE'];

    let created = 0;
    let updated = 0;
    let alreadyExisting = 0;

    for (const sourceRef of ALL_MAPPING_SOURCE_KEYS) {
        for (const m of mappings) {
            const whereKey = {
                sourceType_sourceReference_mappingScope_payloadSubtype_sourcePath_targetFieldNo: {
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: sourceRef,
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
                    transformConfig: (m as any).transformConfig || undefined,
                    filterConfig: (m as any).filterConfig || undefined,
                    syncMode: (m as any).syncMode || 'UPSERT_ONLY',
                    priority: (m as any).priority ?? 100,
                    notes: m.notes
                },
                create: {
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: sourceRef,
                    mappingScope: m.mappingScope,
                    payloadSubtype: m.payloadSubtype,
                    sourcePath: m.sourcePath,
                    targetFieldNo: m.targetFieldNo,
                    isActive: true,
                    transformType: (m as any).transformType || 'DIRECT',
                    transformConfig: (m as any).transformConfig || undefined,
                    filterConfig: (m as any).filterConfig || undefined,
                    syncMode: (m as any).syncMode || 'UPSERT_ONLY',
                    notes: m.notes,
                    priority: (m as any).priority ?? 100
                }
            });

            if (!existing) {
                created++;
                console.log(`  [CREATED] ${sourceRef} | F${m.targetFieldNo} | ${m.sourcePath}`);
            } else {
                const transformChanged = existing.transformType !== ((m as any).transformType || 'DIRECT');
                const syncModeChanged = existing.syncMode !== ((m as any).syncMode || 'UPSERT_ONLY');
                const priorityChanged = existing.priority !== ((m as any).priority ?? 100);
                const notesChanged = existing.notes !== m.notes;
                if (transformChanged || syncModeChanged || priorityChanged || notesChanged) {
                    updated++;
                    console.log(`  [UPDATED] ${sourceRef} | F${m.targetFieldNo} | ${m.sourcePath}`);
                } else {
                    alreadyExisting++;
                    console.log(`  [EXISTS]  ${sourceRef} | F${m.targetFieldNo} | ${m.sourcePath}`);
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
