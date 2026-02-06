"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

export type DashboardContexts = {
    clients: Array<{ id: string; name: string; role: string; source: "DIRECT" | "DERIVED" }>;
    financialInstitutions: Array<{ id: string; name: string; role: string }>;
    lawFirms: Array<{ id: string; name: string; role: string }>;
    legalEntities: Array<{ id: string; name: string; clientName: string; role: string }>;
    relationships: Array<{
        id: string;
        leName: string;
        clientId: string;
        clientName: string;
        supplierName: string;
        status: string;
        fiOrgId: string;
        clientLEId: string;
        userIsClient: boolean;
        userIsSupplier: boolean;
    }>;
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
                    owners: {
                        where: { endAt: null }, // Current owners
                        include: { party: true }
                    }
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

                // IF Admin of Client, fetch ALL its owned LEs (for management view)
                // Note: Implicit access to DATA is denied, but visibility for management is allowed.
                if (m.role === "ADMIN" || m.role === "CLIENT_ADMIN" || m.role === "ORG_ADMIN") {
                    const orgLEs = await prisma.clientLE.findMany({
                        where: {
                            owners: { some: { partyId: org.id, endAt: null } },
                            isDeleted: false,
                            status: { not: "ARCHIVED" }
                        },
                        select: {
                            id: true,
                            name: true,
                            owners: {
                                where: { endAt: null },
                                select: { party: { select: { name: true } } }
                            }
                        }
                    });

                    orgLEs.forEach(le => {
                        const ownerName = le.owners[0]?.party.name || "Unknown Client";
                        if (!leMap.has(le.id)) {
                            leMap.set(le.id, {
                                id: le.id,
                                name: le.name,
                                clientName: ownerName,
                                role: "ADMIN_VISIBILITY" // Special marker? Or just ADMIN?
                            });
                        }
                    });
                }

            } else if (org.types.includes("FI")) {
                context.financialInstitutions.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("LAW_FIRM" as any)) {
                context.lawFirms.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("SYSTEM")) {
                // System Admin: Fetch ALL LEs owned by System
                const orgLEs = await prisma.clientLE.findMany({
                    where: {
                        owners: { some: { partyId: org.id, endAt: null } },
                        isDeleted: false,
                        status: { not: "ARCHIVED" }
                    },
                    select: {
                        id: true,
                        name: true,
                        owners: {
                            where: { endAt: null },
                            select: { party: { select: { name: true } } }
                        }
                    }
                });

                orgLEs.forEach(le => {
                    const ownerName = le.owners[0]?.party.name || "Unknown System";
                    if (!leMap.has(le.id)) {
                        leMap.set(le.id, {
                            id: le.id,
                            name: le.name,
                            clientName: ownerName,
                            role: m.role
                        });
                    }
                });
            }
        }

        // B. Direct Worksheet (LE) Memberships
        if (m.clientLE) {
            const le = m.clientLE;
            // Current owner name
            const ownerName = le.owners[0]?.party.name || "Unknown Client";

            // Upsert (prefer direct role)
            // Existing logic maps ID to role.
            leMap.set(le.id, {
                id: le.id,
                name: le.name,
                clientName: ownerName,
                role: m.role
            });

            // Implied Client Access (Derived)
            // Add all current owners to the client list as DERIVED
            le.owners.forEach(owner => {
                if (!clientMap.has(owner.partyId)) {
                    clientMap.set(owner.partyId, {
                        id: owner.party.id,
                        name: owner.party.name,
                        role: "DERIVED",
                        source: "DERIVED"
                    });
                }
            });
        }
    }

    context.clients = Array.from(clientMap.values());
    context.legalEntities = Array.from(leMap.values());
    const leIds = context.legalEntities.map(l => l.id);

    const fiIds = context.financialInstitutions.map(fi => fi.id);

    // 2. Fetch Relationships (Engagements) for visible LEs OR visible FIs
    if (leIds.length > 0 || fiIds.length > 0) {
        const engagements = await prisma.fIEngagement.findMany({
            where: {
                OR: [
                    { clientLEId: { in: leIds } },
                    { fiOrgId: { in: fiIds } }
                ],
                isDeleted: false
            },
            include: {
                org: true,      // The Supplier (FI)
                clientLE: {
                    include: {
                        owners: {
                            where: { endAt: null },
                            include: { party: true }
                        }
                    }
                }
            }
        });

        context.relationships = engagements.map(e => {
            const owner = e.clientLE.owners[0];
            return {
                id: e.id,
                leName: e.clientLE.name,
                clientId: owner?.partyId || '',
                clientName: owner?.party.name || 'Unknown Client',
                supplierName: e.org.name,
                status: e.status,
                fiOrgId: e.fiOrgId,
                clientLEId: e.clientLEId,
                userIsClient: leIds.includes(e.clientLEId),
                userIsSupplier: fiIds.includes(e.fiOrgId)
            };
        });
    }

    return context;
}
