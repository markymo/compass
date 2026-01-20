// @ts-nocheck
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    const email = "mark@30gram6.com";
    console.log(`Checking roles for email: ${email}`);

    const user = await prisma.user.findFirst({
        where: { email: email }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    console.log(`User ID: ${user.id}`);

    const roles = await prisma.userOrganizationRole.findMany({
        where: { userId: user.id },
        include: {
            org: true
        }
    });

    console.log(`Found ${roles.length} roles:`);
    roles.forEach(r => {
        console.log(` - Role: ${r.role} in Org: ${r.org.name} (Type: ${r.org.types.join(", ")})`);
    });

    // Also check if there is a "Compass System Admin" org at all
    const adminOrg = await prisma.organization.findFirst({
        where: { types: { has: "SYSTEM" } }
    });

    if (adminOrg) {
        console.log(`\nSystem Org Exists: ${adminOrg.name} (${adminOrg.id})`);
        // Check members of system org
        const adminMembers = await prisma.userOrganizationRole.findMany({
            where: { orgId: adminOrg.id },
            include: { user: true }
        });
        console.log("System Org Members:");
        adminMembers.forEach(m => console.log(` - ${m.user.email} (${m.role})`));
    } else {
        console.log("\nWARNING: No organization with type SYSTEM found!");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
