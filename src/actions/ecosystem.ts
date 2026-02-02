"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin";
import { revalidatePath } from "next/cache";

// Helper: Ensure System Admin
async function ensureAdmin() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");
}

// 1. Get Ecosystem Tree
// Returns Clients -> nested Owned LEs -> nested FIEngagements
export async function getEcosystemTree() {
    await ensureAdmin();

    // Fetch all CLIENT organizations
    const clients = await prisma.organization.findMany({
        where: { types: { has: "CLIENT" } },
        orderBy: { name: 'asc' },
        include: {
            ownedLEs: {
                where: { endAt: null }, // Actively owned
                include: {
                    clientLE: {
                        include: {
                            fiEngagements: {
                                where: { isDeleted: false },
                                include: {
                                    org: {
                                        select: { id: true, name: true, logoUrl: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Transform to a clean tree structure
    return clients.map(client => ({
        id: client.id,
        name: client.name,
        logoUrl: client.logoUrl,
        workspaces: client.ownedLEs.map(owner => {
            const le = owner.clientLE;
            return {
                id: le.id,
                name: le.name,
                jurisdiction: le.jurisdiction,
                status: le.status,
                engagements: le.fiEngagements.map(eng => ({
                    id: eng.id,
                    supplierId: eng.org.id,
                    supplierName: eng.org.name,
                    status: eng.status
                }))
            };
        }).sort((a, b) => a.name.localeCompare(b.name))
    }));
}

// 2. Get All Suppliers (for dropdowns)
export async function getAllSuppliers() {
    await ensureAdmin();
    return await prisma.organization.findMany({
        where: { types: { has: "FI" } },
        select: { id: true, name: true, logoUrl: true },
        orderBy: { name: 'asc' }
    });
}

// 3. Create Client Organization
export async function createClient(name: string) {
    await ensureAdmin();
    try {
        await prisma.organization.create({
            data: {
                name,
                types: ["CLIENT"]
            }
        });
        revalidatePath("/app/admin/ecosystem");
        return { success: true };
    } catch (e) {
        console.error("Create Client Error", e);
        return { success: false, error: "Failed to create client" };
    }
}

// 4. Create Supplier Organization
export async function createSupplier(name: string) {
    await ensureAdmin();
    try {
        await prisma.organization.create({
            data: {
                name,
                types: ["FI"] // Financial Institution / Supplier
            }
        });
        revalidatePath("/app/admin/ecosystem");
        return { success: true };
    } catch (e) {
        console.error("Create Supplier Error", e);
        return { success: false, error: "Failed to create supplier" };
    }
}

// 5. Create Workspace (ClientLE) and link to Client
export async function createWorkspace(data: { clientId: string, name: string, jurisdiction: string }) {
    await ensureAdmin();
    const { clientId, name, jurisdiction } = data;

    try {
        // A. Create the Workspace LE
        const le = await prisma.clientLE.create({
            data: {
                name,
                jurisdiction
            }
        });

        // B. Link Owner
        await prisma.clientLEOwner.create({
            data: {
                clientLEId: le.id,
                partyId: clientId
            }
        });

        revalidatePath("/app/admin/ecosystem");
        return { success: true };
    } catch (e) {
        console.error("Create Workspace Error", e);
        return { success: false, error: "Failed to create workspace" };
    }
}

// 6. Engage Supplier (Link FI to Workspace)
export async function engageSupplier(data: { clientLEId: string, supplierId: string }) {
    await ensureAdmin();
    const { clientLEId, supplierId } = data;

    try {
        await prisma.fIEngagement.create({
            data: {
                clientLEId,
                fiOrgId: supplierId,
                status: "PENDING"
            }
        });

        revalidatePath("/app/admin/ecosystem");
        return { success: true };
    } catch (e) {
        console.error("Engage Supplier Error", e);
        return { success: false, error: "Failed to engage supplier" };
    }
}
