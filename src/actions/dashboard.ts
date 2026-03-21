"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

import { DashboardMetric, emptyMetrics, calculateEngagementMetrics, rollupMetrics } from "@/lib/metrics-calc";

export type DashboardContexts = {
    clients: Array<{ id: string; name: string; role: string; source: "DIRECT" | "DERIVED"; metrics: DashboardMetric }>;
    financialInstitutions: Array<{ id: string; name: string; role: string; metrics: DashboardMetric }>;
    lawFirms: Array<{ id: string; name: string; role: string }>;
    legalEntities: Array<{ id: string; name: string; clientName: string; role: string; metrics: DashboardMetric }>;
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
        metrics: DashboardMetric;
        questionnaires?: Array<{ id: string; name: string; status: string; updatedAt: Date }>;
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

    const clientMap = new Map<string, { id: string; name: string; role: string; source: "DIRECT" | "DERIVED"; metrics: DashboardMetric }>();
    const fiMap = new Map<string, { id: string; name: string; role: string; metrics: DashboardMetric }>();
    const leMap = new Map<string, { id: string; name: string; clientName: string; role: string; metrics: DashboardMetric }>();

    for (const m of memberships) {
        // A. Direct Party Memberships
        if (m.organization) {
            const org = m.organization;
            if (org.types.includes("CLIENT")) {
                clientMap.set(org.id, { id: org.id, name: org.name, role: m.role, source: "DIRECT", metrics: emptyMetrics() });

                // IF Admin of Client, fetch ALL its owned LEs (for management view)
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

                    orgLEs.forEach((le: any) => {
                        const ownerName = le.owners[0]?.party.name || "Unknown Client";
                        if (!leMap.has(le.id)) {
                            leMap.set(le.id, {
                                id: le.id,
                                name: le.name,
                                clientName: ownerName,
                                role: "ADMIN_VISIBILITY",
                                metrics: emptyMetrics()
                            });
                        }
                    });
                }

            } else if (org.types.includes("FI")) {
                fiMap.set(org.id, { id: org.id, name: org.name, role: m.role, metrics: emptyMetrics() });
            } else if (org.types.includes("LAW_FIRM" as any)) {
                context.lawFirms.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("SYSTEM")) {
                // System Admin
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

                orgLEs.forEach((le: any) => {
                    const ownerName = le.owners[0]?.party.name || "Unknown System";
                    if (!leMap.has(le.id)) {
                        leMap.set(le.id, {
                            id: le.id,
                            name: le.name,
                            clientName: ownerName,
                            role: m.role,
                            metrics: emptyMetrics()
                        });
                    }
                });
            }
        }

        // B. Direct Worksheet (LE) Memberships
        if (m.clientLE) {
            const le = m.clientLE;
            const ownerName = le.owners[0]?.party.name || "Unknown Client";

            leMap.set(le.id, {
                id: le.id,
                name: le.name,
                clientName: ownerName,
                role: m.role,
                metrics: emptyMetrics()
            });

            le.owners.forEach((owner: any) => {
                if (!clientMap.has(owner.partyId)) {
                    clientMap.set(owner.partyId, {
                        id: owner.party.id,
                        name: owner.party.name,
                        role: "DERIVED",
                        source: "DERIVED",
                        metrics: emptyMetrics()
                    });
                }
            });
        }
    }

    context.clients = Array.from(clientMap.values());
    context.financialInstitutions = Array.from(fiMap.values());
    context.legalEntities = Array.from(leMap.values());
    const leIds = context.legalEntities.map((l: any) => l.id);
    const fiIds = context.financialInstitutions.map((fi: any) => fi.id);

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
                },
                questionnaireInstances: {
                    where: { status: "SHARED", isDeleted: false },
                    select: { id: true, name: true, status: true, updatedAt: true }
                }
            }
        });

        context.relationships = await Promise.all(engagements.map(async (e: any) => {
            const owner = e.clientLE.owners[0];
            const rawMetrics = await calculateEngagementMetrics(e.id);
            const userIsSupplier = fiIds.includes(e.fiOrgId);

            // Filter metrics for Supplier view
            const finalMetrics = userIsSupplier ? {
                total: rawMetrics.total,
                noData: rawMetrics.noData,
                mapped: rawMetrics.mapped,
                answered: rawMetrics.answered,
                approved: rawMetrics.approved,
                released: rawMetrics.released
            } : rawMetrics;

            // Rollup metrics to LE and Client
            const le = leMap.get(e.clientLEId);
            if (le) rollupMetrics(le.metrics, finalMetrics);

            if (owner) {
                const client = clientMap.get(owner.partyId);
                if (client) rollupMetrics(client.metrics, finalMetrics);
            }

            // Rollup to FI if user is a supplier
            if (userIsSupplier) {
                const fi = fiMap.get(e.fiOrgId);
                if (fi) rollupMetrics(fi.metrics, finalMetrics);
            }

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
                userIsSupplier,
                metrics: finalMetrics,
                questionnaires: userIsSupplier ? e.questionnaireInstances : undefined
            };
        }));
    }

    return context;
}
