import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.fieldClaim.count({
        where: { fieldNo: 63 }
    });
    console.log(`Total claims for field 63: ${claims}`);
    
    const sampleClaims = await prisma.fieldClaim.findMany({
        where: { fieldNo: 63 },
        take: 3
    });
    console.log(`Sample claims: ${JSON.stringify(sampleClaims, null, 2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
