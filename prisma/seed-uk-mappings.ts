import { PrismaClient, SourceType, MappingScope, PayloadSubtype, MappingTransformType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUKMappings() {
    const RA_ID = 'RA000585'; // UK Companies House
    
    console.log(`[Seed] Bootstrapping Mapping Pack for UK Companies House (${RA_ID})...`);

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
        }
    ];

    let count = 0;
    for (const m of mappings) {
        await (prisma as any).sourceFieldMapping.upsert({
            where: {
                sourceType_sourceReference_mappingScope_payloadSubtype_sourcePath_targetFieldNo: {
                    sourceType: 'REGISTRATION_AUTHORITY',
                    sourceReference: RA_ID,
                    mappingScope: m.mappingScope,
                    payloadSubtype: m.payloadSubtype,
                    sourcePath: m.sourcePath,
                    targetFieldNo: m.targetFieldNo
                }
            },
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
        count++;
    }

    console.log(`[Seed] Successfully seeded ${count} UK-specific mappings.`);
}


seedUKMappings()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
