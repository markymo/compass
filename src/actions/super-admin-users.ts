"use server";

import bcrypt from "bcryptjs";


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

    // Find organizations matching query (CLIENT only)
    const clients = await prisma.organization.findMany({
        where: {
            name: { contains: query, mode: "insensitive" },
            types: { has: "CLIENT" }
        },
        take: 10,
        orderBy: { name: 'asc' }
    });

    return clients.map(c => ({
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl,
        type: c.types.length > 0 ? c.types[0] : "CLIENT"
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
            clientLE: {
                owners: {
                    some: { partyId: clientId, endAt: null }
                }
            }
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
                clientRole: m.role, // "ORG_ADMIN" | "ORG_MEMBER"
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
            ownedLEs: {
                where: { endAt: null },
                include: {
                    clientLE: {
                        select: { id: true, name: true, status: true, isDeleted: true }
                    }
                }
            }
        }
    });

    if (!client) return null;

    // Transform to flat structure expected by UI
    return {
        ...client,
        clientLEs: client.ownedLEs
            .map(o => o.clientLE)
            .filter(le => !le.isDeleted && le.status !== "ARCHIVED")
            .sort((a, b) => a.name.localeCompare(b.name))
    };
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

// 8. Create Client LE (Super Admin Force Create)
export async function createClientLEForOrg(data: { name: string, jurisdiction: string, orgId: string }) {
    await ensureAdmin();
    const { name, jurisdiction, orgId } = data;

    try {
        const newLE = await prisma.clientLE.create({
            data: {
                name,
                jurisdiction,
                status: "ACTIVE",
                owners: {
                    create: {
                        partyId: orgId,
                        startAt: new Date()
                    }
                }
            }
        });

        revalidatePath("/app/admin/super");
        return { success: true, data: newLE };
    } catch (e) {
        console.error("Create LE Failure", e);
        return { success: false, error: "Failed to create Client Legal Entity (LE) Workspace" };
    }
}

// 9. Update User Basic Info (Name, Description)
export async function updateUserBasicInfo(userId: string, data: { name?: string, description?: string }) {
    await ensureAdmin();

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }) // Allow clearing text
            }
        });

        revalidatePath("/app/admin/super");
        return { success: true };
    } catch (e) {
        console.error("Update User Info Failed", e);
        return { success: false, error: "Failed to update user info" };
    }
}

// 10. Reset User Password
export async function resetUserPassword(userId: string, newPassword: string) {
    await ensureAdmin();

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        revalidatePath("/app/admin/super");
        return { success: true };
    } catch (e) {
        console.error("Reset Password Failed", e);
        return { success: false, error: "Failed to reset password" };
    }
}

// 11. Toggle Demo Actor Status
export async function updateDemoActorStatus(userId: string, isDemoActor: boolean) {
    await ensureAdmin();

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { isDemoActor }
        });

        revalidatePath("/app/admin/super");
        revalidatePath("/app/admin/demo");
        return { success: true };
    } catch (e) {
        console.error("Update Demo Status Failed", e);
        return { success: false, error: "Failed to update demo status" };
    }
}

// 7. Get User Permissions Profile (All Orgs + LEs)
export async function getUserPermissionsProfile(targetUserId: string) {
    await ensureAdmin();

    // 1. Fetch User Details
    const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, email: true, description: true, isDemoActor: true }
    });
    if (!user) return null;

    // 2. Fetch All Org Memberships (Party Scope)
    const orgMemberships = await prisma.membership.findMany({
        where: { userId: targetUserId, organizationId: { not: null } },
        include: { organization: true }
    });

    // 3. Fetch All LE Memberships (Workspace Scope)
    const leMemberships = await prisma.membership.findMany({
        where: { userId: targetUserId, clientLEId: { not: null } },
        select: { clientLEId: true, role: true }
    });

    const leRoleMap = new Map<string, string>();
    leMemberships.forEach(m => {
        if (m.clientLEId) leRoleMap.set(m.clientLEId, m.role);
    });

    // 4. Build Tree
    const tree = await Promise.all(orgMemberships.map(async (om) => {
        if (!om.organization) return null;

        // Fetch owned LEs for this Org
        const ownedLEs = await prisma.clientLEOwner.findMany({
            where: { partyId: om.organization.id, endAt: null },
            include: {
                clientLE: {
                    select: { id: true, name: true, status: true, isDeleted: true }
                }
            }
        });

        // Map LEs with user's role
        const les = ownedLEs.map(owner => {
            const le = owner.clientLE;
            return {
                id: le.id,
                name: le.name,
                status: le.status,
                isDeleted: le.isDeleted,
                role: leRoleMap.get(le.id) || "NONE"
            };
        }).filter(le => !le.isDeleted && le.status !== "ARCHIVED")
            .sort((a, b) => a.name.localeCompare(b.name));

        return {
            org: {
                id: om.organization.id,
                name: om.organization.name,
                logoUrl: om.organization.logoUrl,
                type: om.organization.types.length > 0 ? om.organization.types[0] : "CLIENT"
            },
            role: om.role,
            les
        };
    }));

    return {
        user,
        memberships: tree.filter(Boolean) as any[]
    };
}
