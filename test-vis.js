const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    // get sysorg
    const sysOrg = await prisma.organization.findFirst({ where: { types: { has: 'SYSTEM' } } });
    if (!sysOrg) { console.log("No sys org"); return; }
    
    const snap = await prisma.questionnaire.create({
        data: {
            name: `DISC_TEST_vis`,
            functionalCode: 'DISCTEST',
            fiOrgId: sysOrg.id,
            ownerOrgId: sysOrg.id,
            status: 'ACTIVE',
            kind: 'REFERENCE_SNAPSHOT',
            isTemplate: true,
            isGlobal: true, // TRY TRUE
            visibility: 'PRIVATE',
        },
    });
    console.log("Created snap visibility with isGlobal=true:", snap.visibility);
    
    const snap2 = await prisma.questionnaire.create({
        data: {
            name: `DISC_TEST_vis_2`,
            functionalCode: 'DISCTEST',
            fiOrgId: sysOrg.id,
            ownerOrgId: sysOrg.id,
            status: 'ACTIVE',
            kind: 'REFERENCE_SNAPSHOT',
            isTemplate: true,
            isGlobal: false, // TRY FALSE
            visibility: 'PRIVATE',
        },
    });
    console.log("Created snap visibility with isGlobal=false:", snap2.visibility);
    
    await prisma.questionnaire.delete({ where: { id: snap.id } });
    await prisma.questionnaire.delete({ where: { id: snap2.id } });
}
main();
