
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            memberships: {
                include: {
                    organization: true,
                    clientLE: true,
                },
            },
        },
        orderBy: {
            email: 'asc',
        },
    });

    console.log("# Current User Permission Audit (Live)\n");

    for (const user of users) {
        console.log(`### ${user.email}`);

        if (user.memberships.length === 0) {
            console.log("- No explicit memberships found.\n");
            continue;
        }

        // Group memberships by type (Org vs LE) for cleaner output
        const orgMemberships = user.memberships.filter(m => m.organization);
        const leMemberships = user.memberships.filter(m => m.clientLE);

        if (orgMemberships.length > 0) {
            console.log("**Organization Roles (HQ/Party Level):**");
            for (const m of orgMemberships) {
                const orgName = m.organization.name;
                const orgTypes = m.organization.types.join(", ");
                console.log(`- **${m.role}** at _${orgName}_ (${orgTypes})`);
            }
        }

        if (leMemberships.length > 0) {
            if (orgMemberships.length > 0) console.log(""); // Spacing
            console.log("**Legal Entity Roles (Project/Deal Level):**");
            for (const m of leMemberships) {
                const leName = m.clientLE.name;
                console.log(`- **${m.role}** at _${leName}_`);
            }
        }
        console.log("\n---");
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
