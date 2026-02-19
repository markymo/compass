
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock dependencies
const emptyMetrics = () => ({
    noData: 0, prepopulated: 0, systemUpdated: 0, drafted: 0,
    approved: 0, released: 0, acknowledged: 0
});
const calculateEngagementMetrics = async () => emptyMetrics();
const rollupMetrics = () => { };

async function getDashboardTree(userId) {
    console.log(`Building tree for userId: ${userId}`);

    // 1. Fetch User Memberships
    const memberships = await prisma.membership.findMany({
        where: { userId: userId },
        include: {
            organization: true,
            clientLE: {
                include: {
                    owners: { where: { endAt: null }, include: { party: true } }
                }
            }
        }
    });

    console.log(`Found ${memberships.length} memberships.`);
    const rootItems = [];
    const clientMap = new Map();

    // 2. Build Hierarchy
    for (const m of memberships) {
        if (m.organization) {
            console.log(`Processing Org: ${m.organization.name}, Types: ${JSON.stringify(m.organization.types)}`);

            // CHECK THE CONDITION
            const isClient = m.organization.types.includes("CLIENT");
            console.log(` -> Is Client? ${isClient}`);

            if (isClient) {
                const client = m.organization;
                if (!clientMap.has(client.id)) {
                    clientMap.set(client.id, {
                        id: client.id,
                        name: client.name,
                        type: "CLIENT",
                        role: m.role,
                        children: []
                    });
                }

                // Fetch Children
                console.log(` -> Fetching children for ${client.name}...`);
                await fetchClientChildren(clientMap.get(client.id), true, userId);
            }
        }
    }

    return Array.from(clientMap.values());
}

async function fetchClientChildren(clientNode, isAdmin, userId) {
    const whereClause = {
        owners: { some: { partyId: clientNode.id, endAt: null } },
        isDeleted: false,
    };

    const clientLEs = await prisma.clientLE.findMany({
        where: whereClause,
        include: {
            fiEngagements: {
                where: { isDeleted: false },
                include: { org: true }
            },
            memberships: { where: { userId } }
        }
    });

    console.log(`   -> Found ${clientLEs.length} LEs for ${clientNode.name}`);
    for (const le of clientLEs) {
        clientNode.children.push({ id: le.id, name: le.name, type: "LE" });
    }
}

async function main() {
    const email = 'mark@30gram6.com';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");

    const tree = await getDashboardTree(user.id);
    console.log("FINAL TREE:", JSON.stringify(tree, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
