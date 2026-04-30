import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.masterFieldDefinition.upsert({
        where: { fieldNo: 122 },
        create: {
            fieldNo: 122,
            fieldName: 'Primary Address',
            appDataType: 'ADDRESS_REF',
            isActive: true,
            isMultiValue: false
        },
        update: {
            fieldName: 'Primary Address',
            appDataType: 'ADDRESS_REF'
        }
    });
    console.log("Field 122 added.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
