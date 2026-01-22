"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin"; // Re-use existing check
import { revalidatePath } from "next/cache";

// 1. Get System Stats
export async function getSystemStats() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return null;

    const [clientCount, leCount, userCount, fiCount, lawFirmCount] = await Promise.all([
        prisma.organization.count({ where: { types: { has: "CLIENT" } } }),
        prisma.clientLE.count(),
        prisma.user.count(),
        prisma.organization.count({ where: { types: { has: "FI" } } }),
        prisma.organization.count({ where: { types: { has: "LAW_FIRM" as any } } }),
    ]);

    return {
        clientCount,
        leCount,
        userCount,
        fiCount,
        lawFirmCount
    };
}

// 2. Onboard Client Wizard Action
export async function onboardClient(data: { name: string, adminEmail: string }) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const { name, adminEmail } = data;

    try {
        // A. Create Organization
        const org = await prisma.organization.create({
            data: {
                name,
                types: ["CLIENT"]
            }
        });

        // B. Find or Create User
        let user = await prisma.user.findFirst({
            where: { email: adminEmail }
        });

        if (!user) {
            const { v4: uuidv4 } = require('uuid');
            user = await prisma.user.create({
                data: {
                    id: `invite_${uuidv4()}`,
                    email: adminEmail
                }
            });
        }

        // C. Assign Admin Role
        await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: "ADMIN"
            }
        });

        revalidatePath("/app/admin/super");
        return { success: true, orgId: org.id };

    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to onboard client" };
    }
}
