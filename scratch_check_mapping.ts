import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const field63Mappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 63 }
    });
    console.log("Field 63:");
    console.log(field63Mappings);
    
    const field9999Mappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 9999 }
    });
    console.log("Field 9999:");
    console.log(field9999Mappings);
    
    process.exit(0);
}
main();
