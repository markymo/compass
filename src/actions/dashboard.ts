"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

export type DashboardContexts = {
    clients: Array<{ id: string; name: string; role: string; source: "DIRECT" | "DERIVED" }>;
    financialInstitutions: Array<{ id: string; name: string; role: string }>;
    lawFirms: Array<{ id: string; name: string; role: string }>;
    legalEntities: Array<{ id: string; name: string; clientName: string; role: string }>;
    relationships: Array<{ id: string; leName: string; supplierName: string; status: string }>;
};

export async function getUserContexts(): Promise<DashboardContexts> {
    const identity = await getIdentity();
    if (!identity) {
        return { clients: [], financialInstitutions: [], lawFirms: [], legalEntities: [], relationships: [] };
    }

    // 1. Fetch all memberships
    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        include: {
            organization: true,
            clientLE: {
                include: {
                    clientOrg: true
                }
            }
        }
    });

    const context: DashboardContexts = {
        clients: [],
        financialInstitutions: [],
        lawFirms: [],
        legalEntities: [],
        relationships: []
    };

    const clientMap = new Map<string, { id: string; name: string; role: string; source: "DIRECT" | "DERIVED" }>();
    const leMap = new Map<string, { id: string; name: string; clientName: string; role: string }>();

    for (const m of memberships) {
        // A. Direct Party Memberships
        if (m.organization) {
            const org = m.organization;
            if (org.types.includes("CLIENT")) {
                clientMap.set(org.id, { id: org.id, name: org.name, role: m.role, source: "DIRECT" });

                // NEW: IF Admin/Member of Client, fetch ALL its active LEs
                const orgLEs = await prisma.clientLE.findMany({
                    where: { clientOrgId: org.id, isDeleted: false, status: { not: "ARCHIVED" } },
                    select: { id: true, name: true, clientOrg: { select: { name: true } } }
                });

                orgLEs.forEach(le => {
                    if (!leMap.has(le.id)) {
                        leMap.set(le.id, {
                            id: le.id,
                            name: le.name,
                            clientName: le.clientOrg.name,
                            role: m.role // Inherit Org Role
                        });
                    }
                });

            } else if (org.types.includes("FI")) {
                context.financialInstitutions.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("LAW_FIRM" as any)) {
                context.lawFirms.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("SYSTEM")) {
                // System Admin: ALSO fetch all LEs of this 'System' org if it acts as a client
                const orgLEs = await prisma.clientLE.findMany({
                    where: { clientOrgId: org.id, isDeleted: false, status: { not: "ARCHIVED" } },
                    select: { id: true, name: true, clientOrg: { select: { name: true } } }
                });

                orgLEs.forEach(le => {
                    if (!leMap.has(le.id)) {
                        leMap.set(le.id, {
                            id: le.id,
                            name: le.name,
                            clientName: le.clientOrg.name,
                            role: m.role
                        });
                    }
                });
            }
        }

        // B. Direct Worksheet (LE) Memberships
        if (m.clientLE) {
            const le = m.clientLE;

            // Upsert (prefer direct role if we want to be specific, or just ensure existence)
            // If already added by Org logic, this might be redundant, OR we might want to update the role to the specific LE role?
            // For now, simple existence check to avoid duplicates.
            if (!leMap.has(le.id)) {
                leMap.set(le.id, {
                    id: le.id,
                    name: le.name,
                    clientName: le.clientOrg.name,
                    role: m.role
                });
            }

            // Implied Client Access (Derived)
            if (!clientMap.has(le.clientOrgId)) {
                clientMap.set(le.clientOrgId, {
                    id: le.clientOrg.id,
                    name: le.clientOrg.name,
                    role: "DERIVED", // Not a direct member
                    source: "DERIVED"
                });
            }
        }
    }

    context.clients = Array.from(clientMap.values());
    context.legalEntities = Array.from(leMap.values());
    const leIds = context.legalEntities.map(l => l.id);

    // 2. Fetch Relationships (Engagements) for visible LEs
    if (leIds.length > 0) {
        const engagements = await prisma.fIEngagement.findMany({
            where: {
                clientLEId: { in: leIds },
                isDeleted: false
            },
            include: {
                org: true,      // The Supplier (FI)
                clientLE: true  // The Workspace (LE)
            }
        });

        context.relationships = engagements.map(e => ({
            id: e.id,
            leName: e.clientLE.name,
            supplierName: e.org.name,
            status: e.status
        }));
    }

    return context;
}
