
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPermissions() {
    const email = "mark@30ram6.com";

    console.log(`Checking permissions for: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            memberships: {
                include: {
                    organization: true,
                    clientLE: true
                }
            }
        }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    console.log("User ID:", user.id);
    console.log("Memberships:", JSON.stringify(user.memberships, null, 2));

    // Check logic that 'createClientLE' uses
    const adminMemberships = user.memberships.filter(m =>
        m.role === "ADMIN" &&
        m.organization &&
        m.organization.types.includes("CLIENT")
    );

    console.log("\n--- 'createClientLE' Logic Check ---");
    console.log(`Found ${adminMemberships.length} CLIENT ADMIN memberships.`);

    adminMemberships.forEach(m => {
        console.log(`- Org: ${m.organization.name} (${m.organization.id})`);
    });

    if (adminMemberships.length === 0) {
        console.log("FAILURE PREDICTION: User will get 'No permission' error.");
    } else if (adminMemberships.length > 1) {
        console.log("FAILURE PREDICTION: User will get 'Ambiguous context' error if orgId not explicitly sent.");
    } else {
        console.log("SUCCESS PREDICTION: Should verify against 'ensureAuthorization'.");
    }
}

checkUserPermissions()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
