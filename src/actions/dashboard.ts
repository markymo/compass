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
    const leIds: string[] = [];

    for (const m of memberships) {
        // A. Direct Party Memberships
        if (m.organization) {
            const org = m.organization;
            if (org.types.includes("CLIENT")) {
                clientMap.set(org.id, { id: org.id, name: org.name, role: m.role, source: "DIRECT" });
            } else if (org.types.includes("FI")) {
                context.financialInstitutions.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("LAW_FIRM" as any)) { // Cast to any to avoid temporarily missing type issue before regen finishes or just string check
                context.lawFirms.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("SYSTEM")) {
                // System admin logic
            }
        }

        // B. Direct Worksheet (LE) Memberships
        if (m.clientLE) {
            const le = m.clientLE;
            leIds.push(le.id);

            context.legalEntities.push({
                id: le.id,
                name: le.name,
                clientName: le.clientOrg.name,
                role: m.role
            });

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
