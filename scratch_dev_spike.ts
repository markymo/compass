import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const category = await prisma.masterDataCategory.findFirst();
    const categoryId = category?.id || 'GENERAL';
    const fieldNo = 9999;
    
    console.log(`[1] Creating MasterFieldDefinition ${fieldNo}...`);
    // Delete if exists
    await prisma.masterFieldDefinition.deleteMany({ where: { fieldNo } });
    
    await prisma.masterFieldDefinition.create({
        data: {
            fieldNo,
            fieldName: 'All Officers Test',
            appDataType: 'PARTY',
            isMultiValue: true,
            categoryId,
            profileConfig: {
                displayMask: ["forenames", "surname"],
                allowedPartyTypes: ["INDIVIDUAL", "ORGANIZATION"],
            }
        }
    });

    console.log(`[2] Creating SourceFieldMapping for ${fieldNo}...`);
    await prisma.sourceFieldMapping.deleteMany({ where: { targetFieldNo: fieldNo } });
    
    // Copy the Field 63 config but change transform to TO_PARTY_VALUE_LIST
    await prisma.sourceFieldMapping.create({
        data: {
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE',
            mappingScope: 'RAW_PAYLOAD',
            payloadSubtype: 'OFFICERS',
            sourcePath: '$',
            targetFieldNo: fieldNo,
            confidenceDefault: 1,
            transformType: 'TO_PARTY_VALUE_LIST', // Returns all officers
            transformConfig: {
                dobYearPath: 'date_of_birth.year',
                dobMonthPath: 'date_of_birth.month',
                fullNamePath: 'name',
                roleTitlePath: 'officer_role',
                resignedOnPath: 'resigned_on',
                appointedOnPath: 'appointed_on',
                nationalityPath: 'nationality',
                sourceIdentifiers: [{
                    domain: "companies_house",
                    identifierPath: "links.self"
                }],
                countryOfResidencePath: 'country_of_residence'
            },
            syncMode: 'SNAPSHOT_SYNC',
            priority: 10,
            isActive: true,
            notes: 'Dev Spike: All CH Officers to Field 9999',
            version: 1
        }
    });
    
    console.log('Setup complete.');
    process.exit(0);
}
main().catch(console.error);
