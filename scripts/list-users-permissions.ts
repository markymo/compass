
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

    console.log("| Email | Role | Context (Scope) |");
    console.log("| :--- | :--- | :--- |");

    for (const user of users) {
        if (user.memberships.length === 0) {
            console.log(`| ${user.email} | No Membership | - |`);
            continue;
        }

        for (const m of user.memberships) {
            let scope = "Unknown";
            if (m.organization) {
                scope = `Org: ${m.organization.name} (${m.organization.types.join(", ")})`;
            } else if (m.clientLE) {
                scope = `LE: ${m.clientLE.name}`;
            }

            console.log(`| ${user.email} | **${m.role}** | ${scope} |`);
        }
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
