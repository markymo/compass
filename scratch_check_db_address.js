const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.fieldClaim.findMany({
        where: { valueJson: { not: null } },
        take: 1000
    });

    let addressCount = 0;
    let countryCodeCount = 0;
    let countryNameCount = 0;
    
    for (const c of claims) {
        if (c.valueJson && typeof c.valueJson === 'object' && c.valueJson.addressLines) {
            addressCount++;
            if (c.valueJson.countryCode) countryCodeCount++;
            if (c.valueJson.countryName) countryNameCount++;
        }
    }
    
    console.log(`Addresses found: ${addressCount}`);
    console.log(`With countryCode: ${countryCodeCount}`);
    console.log(`With countryName: ${countryNameCount}`);

    // Sample an address from GLEIF if available
    const gleifClaim = claims.find(c => c.sourceType === 'GLEIF' && c.valueJson && typeof c.valueJson === 'object' && c.valueJson.addressLines);
    console.log("GLEIF Sample:", gleifClaim ? JSON.stringify(gleifClaim.valueJson, null, 2) : "None");

    const chClaim = claims.find(c => c.sourceType === 'COMPANIES_HOUSE' && c.valueJson && typeof c.valueJson === 'object' && c.valueJson.addressLines);
    console.log("CH Sample:", chClaim ? JSON.stringify(chClaim.valueJson, null, 2) : "None");
}
main().finally(() => prisma.$disconnect());
