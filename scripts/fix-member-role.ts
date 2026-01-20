// @ts-nocheck
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    const email = "mark@30gram6.com";
    console.log(`Fixing roles for email: ${email}`);

    // 1. Get User
    const user = await prisma.user.findFirst({
        where: { email: email }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    // 2. Get System Admin Org
    const adminOrg = await prisma.organization.findFirst({
        where: { types: { has: "SYSTEM" } }
    });

    if (!adminOrg) {
        console.log("System Org not found!");
        return;
    }

    console.log(`Adding ${email} to ${adminOrg.name}...`);

    // 3. Create Role
    await prisma.userOrganizationRole.upsert({
        where: {
            userId_orgId: {
                userId: user.id,
                orgId: adminOrg.id
            }
        },
        create: {
            userId: user.id,
            orgId: adminOrg.id,
            role: "ADMIN"
        },
        update: {
            role: "ADMIN" // Ensure they are admin
        }
    });

    console.log("SUCCESS: User added to System Admin Org!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
