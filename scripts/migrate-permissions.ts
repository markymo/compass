
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migratePermissions() {
    console.log("Starting permission migration...");

    try {
        // 1. Migrate ADMIN roles
        const adminMemberships = await prisma.membership.findMany({
            where: { role: "ADMIN" },
        });
        console.log(`Found ${adminMemberships.length} memberships with role 'ADMIN'`);

        for (const m of adminMemberships) {
            let newRole = "ORG_ADMIN"; // Default
            if (m.clientLEId) {
                newRole = "LE_ADMIN";
            }

            console.log(`Migrating Membership ${m.id} (User: ${m.userId}) from ADMIN to ${newRole}`);
            await prisma.membership.update({
                where: { id: m.id },
                data: { role: newRole },
            });
        }

        // 2. Migrate MEMBER roles
        const memberMemberships = await prisma.membership.findMany({
            where: { role: "MEMBER" },
        });
        console.log(`Found ${memberMemberships.length} memberships with role 'MEMBER'`);

        for (const m of memberMemberships) {
            let newRole = "ORG_MEMBER"; // Default
            if (m.clientLEId) {
                newRole = "LE_USER";
            }

            console.log(`Migrating Membership ${m.id} (User: ${m.userId}) from MEMBER to ${newRole}`);
            await prisma.membership.update({
                where: { id: m.id },
                data: { role: newRole },
            });
        }

        // 3. Migrate any other Legacy/Ambiguous roles if necessary
        // (None known currently, strictly ADMIN/MEMBER were the generic ones)

        console.log("Migration complete.");
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

migratePermissions();
