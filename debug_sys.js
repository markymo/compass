
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSystemOrg() {
    console.log("Checking for SYSTEM organization...");

    const sysOrg = await prisma.organization.findFirst({
        where: { types: { has: "SYSTEM" } },
        include: { memberships: { include: { user: true } } }
    });

    if (!sysOrg) {
        console.log("No SYSTEM organization found!");
    } else {
        console.log(`SYSTEM Org Found: ${sysOrg.name} (${sysOrg.id})`);
        console.log("Members:");
        sysOrg.memberships.forEach(m => {
            console.log(`- ${m.user.email} (${m.role})`);
        });
    }

    // Check specific user
    const email = "mark@30gram6.com";
    console.log(`\nChecking specific user: ${email}`);
    const user = await prisma.user.findUnique({
        where: { email },
        include: { memberships: { include: { organization: true } } }
    });

    if (user) {
        const isSys = user.memberships.some(m => m.organization?.types.includes("SYSTEM"));
        console.log(`Is System Admin? ${isSys}`);
    } else {
        console.log("User not found");
    }

}

checkSystemOrg()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
