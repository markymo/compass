import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== MEMBERSHIP SCOPE COUNTS ===");
    const orgScoped = await prisma.membership.groupBy({
        by: ['role'],
        where: { organizationId: { not: null }, clientLEId: null, fiEngagementId: null },
        _count: { _all: true }
    });
    console.log("Org-scoped Memberships:");
    console.log(orgScoped.map(r => `  Role: ${r.role}, Count: ${r._count._all}`));

    const leScoped = await prisma.membership.groupBy({
        by: ['role'],
        where: { organizationId: null, clientLEId: { not: null }, fiEngagementId: null },
        _count: { _all: true }
    });
    console.log("\nClientLE-scoped Memberships:");
    console.log(leScoped.map(r => `  Role: ${r.role}, Count: ${r._count._all}`));

    const engScoped = await prisma.membership.groupBy({
        by: ['role'],
        where: { organizationId: null, clientLEId: null, fiEngagementId: { not: null } },
        _count: { _all: true }
    });
    console.log("\nFIEngagement-scoped Memberships:");
    console.log(engScoped.map(r => `  Role: ${r.role}, Count: ${r._count._all}`));

    const legacyScoped = await prisma.membership.groupBy({
        by: ['role'],
        where: { organizationId: { not: null }, clientLEId: { not: null } },
        _count: { _all: true }
    });
    console.log("\nLegacy Dual-scoped Memberships (Org + LE):");
    console.log(legacyScoped.map(r => `  Role: ${r.role}, Count: ${r._count._all}`));


    console.log("\n=== ALL ROLES IN USE ===");
    const allRoles = await prisma.membership.groupBy({
        by: ['role'],
        _count: { _all: true }
    });
    console.log(allRoles.map(r => `  Role: ${r.role}, Count: ${r._count._all}`));

    console.log("\n=== ENGAGEMENT COUNTS ===");
    const engagements = await prisma.fIEngagement.groupBy({
        by: ['fiOrgId', 'isDeleted'],
        _count: { _all: true }
    });
    console.log(engagements.map(r => `  FI Org: ${r.fiOrgId}, isDeleted: ${r.isDeleted}, Count: ${r._count._all}`));

    console.log("\n=== FI USERS CHECK ===");
    const fiUsersCount = await prisma.membership.count({
        where: { organization: { types: { has: "FI" } } }
    });
    console.log(`Total explicit memberships linked to an FI organization: ${fiUsersCount}`);

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
