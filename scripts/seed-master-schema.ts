import { PrismaClient } from '@prisma/client';
import { FIELD_DEFINITIONS } from '../src/domain/kyc/FieldDefinitions';
import { FIELD_GROUPS } from '../src/domain/kyc/FieldGroups';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Dynamic Master Data Schema...');

    // 1. Atomic Fields
    let fieldCount = 0;
    for (const key of Object.keys(FIELD_DEFINITIONS)) {
        const fieldNo = Number(key);
        const def = FIELD_DEFINITIONS[fieldNo];

        await prisma.masterFieldDefinition.upsert({
            where: { fieldNo: fieldNo },
            update: {
                fieldName: def.fieldName,
                appDataType: def.appDataType,
                isMultiValue: def.isMultiValue,
                options: (def as any).options || [],
                notes: def.notes,
                category: def.model,
                modelField: def.field,
                isActive: true,
            },
            create: {
                fieldNo: fieldNo,
                fieldName: def.fieldName,
                appDataType: def.appDataType,
                isMultiValue: def.isMultiValue,
                options: (def as any).options || [],
                notes: def.notes,
                category: def.model,
                modelField: def.field,
                isActive: true,
                order: fieldNo * 10,
            }
        });
        fieldCount++;
    }
    console.log(` ✅ Seeded ${fieldCount} Atomic Fields.`);

    // 2. Field Groups
    let groupCount = 0;
    for (const key of Object.keys(FIELD_GROUPS)) {
        const group = FIELD_GROUPS[key];
        const dbGroup = await prisma.masterFieldGroup.upsert({
            where: { key: key },
            update: {
                label: group.label,
                description: group.description,
                isActive: true,
            },
            create: {
                key: key,
                label: group.label,
                description: group.description,
                isActive: true,
                order: groupCount * 10,
            }
        });

        // Linked Items
        for (let i = 0; i < group.fieldNos.length; i++) {
            const fieldNo = group.fieldNos[i];
            await prisma.masterFieldGroupItem.upsert({
                where: {
                    groupId_fieldNo: {
                        groupId: dbGroup.id,
                        fieldNo: fieldNo
                    }
                },
                update: {
                    order: i * 10,
                    hideFromFieldPicker: true,
                },
                create: {
                    groupId: dbGroup.id,
                    fieldNo: fieldNo,
                    order: i * 10,
                    hideFromFieldPicker: true,
                }
            });
        }
        groupCount++;
    }
    console.log(` ✅ Seeded ${groupCount} Field Groups.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
