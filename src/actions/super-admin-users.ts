"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin";
import { revalidatePath } from "next/cache";

// Helper: Ensure System Admin
async function ensureAdmin() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");
}

// 1. Search Clients for Selector
export async function searchClients(query: string) {
    await ensureAdmin();

    // Find organizations of type CLIENT matching query
    const clients = await prisma.organization.findMany({
        where: {
            types: { has: "CLIENT" },
            name: { contains: query, mode: "insensitive" }
        },
        take: 10,
        orderBy: { name: 'asc' }
    });

    return clients.map(c => ({
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl
    }));
}

// 2. Get All Users associated with a Client (Direct or Indirect)
export async function getClientUsers(clientId: string) {
    await ensureAdmin();

    // Strategy:
    // A. Find users with direct membership to the Org
    // B. Find users with membership to any LE of the Org
    // Merge results.

    // A. Direct Members
    const directMembers = await prisma.membership.findMany({
        where: { organizationId: clientId },
        include: { user: true }
    });

    // B. LE Members
    const leMembers = await prisma.membership.findMany({
        where: {
            clientLE: { clientOrgId: clientId }
        },
        include: {
            user: true,
            clientLE: true
        }
    });

    // Merge Map
    const userMap = new Map<string, any>();

    // Process Direct
    directMembers.forEach((m: any) => {
        if (!userMap.has(m.userId)) {
            userMap.set(m.userId, {
                user: { id: m.user.id, name: m.user.name, email: m.user.email },
                clientRole: m.role, // "ADMIN" | "MEMBER"
                leRoles: {}
            });
        } else {
            const entry = userMap.get(m.userId);
            entry.clientRole = m.role;
        }
    });

    // Process LE
    leMembers.forEach((m: any) => {
        if (!userMap.has(m.userId)) {
            userMap.set(m.userId, {
                user: { id: m.user.id, name: m.user.name, email: m.user.email },
                clientRole: null, // No direct client role yet
                leRoles: {}
            });
        }

        const entry = userMap.get(m.userId);
        if (m.clientLEId) {
            entry.leRoles[m.clientLEId] = m.role; // e.g. "EDITOR"
        }
    });

    return Array.from(userMap.values());
}

// 3. Get Client Context (LEs list for the matrix columns)
export async function getClientContext(clientId: string) {
    await ensureAdmin();

    const client = await prisma.organization.findUnique({
        where: { id: clientId },
        include: {
            clientLEs: {
                where: { isDeleted: false, status: { not: "ARCHIVED" } },
                select: { id: true, name: true }
            }
        }
    });

    return client;
}

// 4. Assign Client Role (Building Pass)
export async function assignClientRole(data: { userId: string, clientId: string, role: string }) {
    await ensureAdmin();
    const { userId, clientId, role } = data;

    try {
        if (role === "NONE") {
            // Remove Membership
            await prisma.membership.deleteMany({
                where: {
                    userId,
                    organizationId: clientId
                }
            });
        } else {
            // Upsert Membership
            // Check existing first to handle unique constraint cleanly manually if needed, or use upsert.
            // Membership unique constraint is [userId, organizationId, clientLEId]
            // For Org membership, clientLEId is null.

            // To be safe with generated IDs, we findFirst then update/create
            const existing = await prisma.membership.findFirst({
                where: { userId, organizationId: clientId } // clientLEId implicitly null check? No, explicitly needed if query isn't strict? 
                // DB definition: organizationId is distinct from clientLEId. A membership has one or the other usually, but model allows both?
                // Our model is polymorphic: One OR Other.
                // Constraint: @@unique([userId, organizationId, clientLEId])
                // Prisma considers nulls in unique constraints differently depending on DB. Postgres treats NULLs as distinct usually, 
                // but prisma handles it.
                // Actually our schema says: one role per scope instance.
                // If orgId is set, it's an org membership.
            });

            if (existing) {
                await prisma.membership.update({
                    where: { id: existing.id },
                    data: { role }
                });
            } else {
                await prisma.membership.create({
                    data: {
                        userId,
                        organizationId: clientId,
                        role
                    }
                });
            }
        }
        revalidatePath("/app/admin/super");
        return { success: true };
    } catch (e) {
        console.error("Assign Client Role Error", e);
        return { success: false, error: "Failed to update role" };
    }
}

// 5. Assign LE Role (Room Key)
export async function assignLERole(data: { userId: string, leId: string, role: string }) {
    await ensureAdmin();
    const { userId, leId, role } = data;

    try {
        if (role === "NONE") {
            await prisma.membership.deleteMany({
                where: {
                    userId,
                    clientLEId: leId
                }
            });
        } else {
            const existing = await prisma.membership.findFirst({
                where: { userId, clientLEId: leId }
            });

            if (existing) {
                await prisma.membership.update({
                    where: { id: existing.id },
                    data: { role }
                });
            } else {
                await prisma.membership.create({
                    data: {
                        userId,
                        clientLEId: leId,
                        role
                    }
                });
            }
        }
        revalidatePath("/app/admin/super");
        return { success: true };
    } catch (e) {
        console.error("Assign LE Role Error", e);
        return { success: false, error: "Failed to update role" };
    }
}

// 6. Invite/Add User to Client
export async function addUserToClient(data: { email: string, clientId: string, name?: string, initialRole: string }) {
    await ensureAdmin();
    const { email, clientId, name, initialRole } = data;

    try {
        // A. Find or Create User
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Create Placeholder
            const { v4: uuidv4 } = require('uuid');
            user = await prisma.user.create({
                data: {
                    id: `invite_${uuidv4()}`,
                    email,
                    name: name || email.split("@")[0]
                }
            });
        }

        // B. Assign Role
        // We reuse logic or direct create
        await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: clientId,
                role: initialRole
            }
        });

        revalidatePath("/app/admin/super");
        return { success: true };

    } catch (e) {
        console.error("Add User Error", e);
        return { success: false, error: "Failed to add user" };
    }
}
