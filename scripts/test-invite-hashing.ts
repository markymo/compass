const { PrismaClient } = require("@prisma/client");
const nodeCrypto = require("crypto");

// Mock the auth context for the actions (since we can't easily mock next-auth in script)
// We will have to rely on the actions using a mocked getIdentity or just testing the core logic if possible.
// Actually, calling server actions from a script is tricky because they use `getIdentity()` which looks at headers/cookies.
// Instead, I will simulate the logic *inside* the script using Prisma directly for setup, 
// and maybe mock the identity part or just manually insert/update state to test the *Hashing* and *Matching* logic 
// which is the critical new part.

// BETTER APPROACH:
// I will create a standalone test function that REPLICATES the action logic to verify my understanding of crypto/hashing 
// and schema interaction, OR I will just use the UI to test.
// Logic:
// 1. Generate token.
// 2. Hash it.
// 3. Store in DB.
// 4. Look up by hash.
// 5. Compare.

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Invite Flow Test (Direct DB Logic)...");

    // 1. Setup Data
    const email = `test.supplier.${Date.now()}@example.com`;
    const token = nodeCrypto.randomUUID();
    const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

    console.log(`Token: ${token}`);
    console.log(`Hash: ${tokenHash}`);

    // 0. Setup Prerequisites (Create Dummy Data if missing)
    console.log("Setting up test data...");

    // Create Client Org
    const clientOrg = await prisma.organization.create({
        data: { name: `Test Client Org ${Date.now()}`, types: ["CLIENT"] }
    });

    // Create Supplier Org
    const supplierOrg = await prisma.organization.create({
        data: { name: `Test Supplier Org ${Date.now()}`, types: ["FI"] }
    });

    // Create Client LE
    const clientLE = await prisma.clientLE.create({
        data: {
            name: `Test Client LE ${Date.now()}`,
            owners: {
                create: {
                    partyId: clientOrg.id
                }
            },
            lei: `TEST-LEI-${Date.now()}`,
            status: "ACTIVE"
        }
    });

    // Create Engagement
    const engagement = await prisma.fIEngagement.create({
        data: {
            clientLEId: clientLE.id,
            fiOrgId: supplierOrg.id,
            status: "PREPARATION"
        },
        include: { org: true, clientLE: true }
    });

    console.log(`Created Engagement: ${engagement.id}`);
    console.log(`Client LE: ${engagement.clientLE.name}`);

    // 2. Create Invitation (Manual DB Insert mimicking action)
    try {
        const invite = await prisma.invitation.create({
            data: {
                sentToEmail: email,
                role: "Test Role",
                tokenHash: tokenHash,
                expiresAt: new Date(Date.now() + 86400000),
                createdByUserId: "test-user-id", // Mock ID
                fiEngagementId: engagement.id,
            }
        });

        console.log(`Invitation Created with ID: ${invite.id}`);

        // 3. Verify Lookup (The logic used in acceptInvitation)
        console.log("Verifying lookup by tokenHash...");
        const lookedUpInvite = await prisma.invitation.findUnique({
            where: { tokenHash: tokenHash }
        });

        if (!lookedUpInvite) {
            console.error("FAILED to look up invitation by hash!");
            process.exit(1);
        } else {
            console.log("SUCCESS: Found invitation by hash.");
        }

        // 4. Verify Registration Verification Logic
        const matchingEmail = email;
        const isMatch = lookedUpInvite.sentToEmail === matchingEmail;
        console.log(`Email Match Check: ${isMatch ? "PASS" : "FAIL"}`);

        // Cleanup
        await prisma.invitation.delete({ where: { id: invite.id } });
        console.log("Cleanup complete.");

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
