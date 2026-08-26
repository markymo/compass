"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { getLEDisplayName } from "@/lib/le-display-name";

import { DashboardMetric, emptyMetrics, calculateEngagementOwnMetrics, calculateCommonQuestionnaireMetrics, rollupMetrics } from "@/lib/metrics-calc";
import {
    QuestionStateMetrics,
    emptyQuestionStateMetrics,
    rollupQuestionStateMetrics,
    calculateCQQuestionStateMetrics,
    calculateEngagementQuestionStateMetrics,
} from "@/lib/metrics/question-state-metrics";

export type DashboardContexts = {
    clients: Array<{ id: string; name: string; role: string; source: "DIRECT" | "DERIVED"; metrics: DashboardMetric; v2Metrics?: QuestionStateMetrics }>;
    financialInstitutions: Array<{ id: string; name: string; role: string; metrics: DashboardMetric; v2Metrics?: QuestionStateMetrics }>;
    lawFirms: Array<{ id: string; name: string; role: string }>;
    legalEntities: Array<{
        id: string;
        name: string;
        clientName: string;
        role: string;
        metrics: DashboardMetric;
        v2Metrics?: QuestionStateMetrics;
        commonQuestionnaires?: Array<{ id: string; name: string; status: string; updatedAt: Date; metrics: DashboardMetric; v2Metrics?: QuestionStateMetrics }>;
    }>;
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
        v2Metrics?: QuestionStateMetrics;
        questionnaires?: Array<{ id: string; name: string; status: string; updatedAt: Date }>;
    }>;
};

export async function getUserContexts(): Promise<DashboardContexts> {
    const identity = await getIdentity();
    if (!identity) {
        return { clients: [], financialInstitutions: [], lawFirms: [], legalEntities: [], relationships: [] };
    }

    // 1. Fetch all memberships with their related entities
    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        include: {
            organization: true,
            clientLE: {
                include: {
                    owners: {
                        where: { endAt: null },
                        include: { party: true }
                    }
                }
            },
            fiEngagement: {
                include: {
                    org: true,
                    clientLE: {
                        include: {
                            owners: {
                                where: { endAt: null },
                                include: { party: true }
                            }
                        }
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
    const lawFirms: Array<{ id: string; name: string; role: string }> = [];

    // All LEs that are structurally visible to the user
    const structurallyVisibleLEMap = new Map<string, { id: string; name: string; clientName: string; role: string; metrics: DashboardMetric; commonQuestionnaires?: any[] }>();

    // Explicit sets of IDs that are OPERATIONALLY visible to the user
    const operationallyVisibleLEIds = new Set<string>();
    const operationallyVisibleEngagementIds = new Set<string>();

    for (const m of memberships) {
        // A. Direct ClientLE Memberships (Operational access to ClientLE)
        if (m.clientLE && !m.clientLE.isDeleted && m.clientLE.status !== "ARCHIVED") {
            const le = m.clientLE;
            const ownerName = le.owners[0]?.party.name || "Unknown Client";

            operationallyVisibleLEIds.add(le.id);

            structurallyVisibleLEMap.set(le.id, {
                id: le.id,
                name: getLEDisplayName(le),
                clientName: ownerName,
                role: m.role, // e.g. "LE_ADMIN" or "LE_USER"
                metrics: emptyMetrics()
            });

            // Derive parent client organization if not already direct
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

        // B. Direct Relationship Memberships (Operational access to specific Engagement)
        if (m.fiEngagement && !m.fiEngagement.isDeleted) {
            const engagement = m.fiEngagement;
            operationallyVisibleEngagementIds.add(engagement.id);

            const supplierOrg = engagement.org;
            if (supplierOrg && !fiMap.has(supplierOrg.id)) {
                fiMap.set(supplierOrg.id, {
                    id: supplierOrg.id,
                    name: supplierOrg.name,
                    role: m.role.startsWith("RELATIONSHIP_") ? "DERIVED" : m.role,
                    metrics: emptyMetrics()
                });
            }
        }

        // C. Direct Organization Memberships (Structural administration / association only)
        if (m.organization && !m.clientLEId && !m.fiEngagementId) {
            const org = m.organization;
            if (org.types.includes("CLIENT")) {
                const existing = clientMap.get(org.id);
                clientMap.set(org.id, {
                    id: org.id,
                    name: org.name,
                    role: m.role,
                    source: "DIRECT",
                    metrics: existing ? existing.metrics : emptyMetrics()
                });

                // Client ORG_ADMIN (and legacy CLIENT_ADMIN / ADMIN) gets structural visibility of owned ClientLEs
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
                            gleifData: true,
                            owners: {
                                where: { endAt: null },
                                select: { party: { select: { name: true } } }
                            }
                        }
                    });

                    orgLEs.forEach((le: any) => {
                        const ownerName = le.owners[0]?.party.name || org.name;
                        // Do not overwrite direct operational role if user already has LE_ADMIN/LE_USER
                        if (!structurallyVisibleLEMap.has(le.id)) {
                            structurallyVisibleLEMap.set(le.id, {
                                id: le.id,
                                name: getLEDisplayName(le),
                                clientName: ownerName,
                                role: "ADMIN_VISIBILITY",
                                metrics: emptyMetrics()
                            });
                        }
                    });
                }
            } else if (org.types.includes("FI")) {
                const existing = fiMap.get(org.id);
                fiMap.set(org.id, {
                    id: org.id,
                    name: org.name,
                    role: m.role,
                    metrics: existing ? existing.metrics : emptyMetrics()
                });
                // Supplier ORG_ADMIN / ORG_MEMBER does NOT receive automatic engagement visibility.
            } else if (org.types.includes("LAW_FIRM" as any)) {
                lawFirms.push({ id: org.id, name: org.name, role: m.role });
            } else if (org.types.includes("SYSTEM")) {
                // System Admin is platform admin only — no customer operational access
            }
        }
    }

    context.clients = Array.from(clientMap.values());
    context.financialInstitutions = Array.from(fiMap.values());
    context.lawFirms = lawFirms;
    context.legalEntities = Array.from(structurallyVisibleLEMap.values());

    const operationalLEIdsArray = Array.from(operationallyVisibleLEIds);

    // 2. Process Common Questionnaires ONLY for operationally visible LEs
    const leCommonQsMap = new Map<string, Array<{ id: string; name: string; status: string; updatedAt: Date; metrics: DashboardMetric }>>();

    if (operationalLEIdsArray.length > 0) {
        const lesWithCQs = await prisma.clientLE.findMany({
            where: { id: { in: operationalLEIdsArray } },
            select: {
                id: true,
                commonQuestionnaires: {
                    where: { isDeleted: false, isTemplate: false },
                    select: { id: true, name: true, status: true, updatedAt: true }
                }
            }
        });

        await Promise.all(lesWithCQs.flatMap((le: any) =>
            le.commonQuestionnaires.map(async (cq: any) => {
                const cqMetrics = await calculateCommonQuestionnaireMetrics(cq.id, le.id);
                if (!leCommonQsMap.has(le.id)) {
                    leCommonQsMap.set(le.id, []);
                }
                leCommonQsMap.get(le.id)!.push({
                    id: cq.id,
                    name: cq.name,
                    status: cq.status,
                    updatedAt: cq.updatedAt,
                    metrics: cqMetrics
                });

                // Rollup metrics to LE ONCE
                const leItem = structurallyVisibleLEMap.get(le.id);
                if (leItem) {
                    rollupMetrics(leItem.metrics, cqMetrics);
                }
            })
        ));
    }

    context.legalEntities.forEach(le => {
        le.commonQuestionnaires = leCommonQsMap.get(le.id) || [];
    });

    // 3. Fetch Relationships (Engagements) ONLY for operationally visible LEs (Client side) OR explicit relationship memberships (Supplier side)
    const engagementQueryConditions: any[] = [];
    if (operationalLEIdsArray.length > 0) {
        engagementQueryConditions.push({ clientLEId: { in: operationalLEIdsArray } });
    }
    if (operationallyVisibleEngagementIds.size > 0) {
        engagementQueryConditions.push({ id: { in: Array.from(operationallyVisibleEngagementIds) } });
    }

    if (engagementQueryConditions.length > 0) {
        const engagements = await prisma.fIEngagement.findMany({
            where: {
                OR: engagementQueryConditions,
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
            const ownMetrics = await calculateEngagementOwnMetrics(e.id);
            const userIsClient = operationallyVisibleLEIds.has(e.clientLEId);
            const userIsSupplier = operationallyVisibleEngagementIds.has(e.id);

            // Rollup engagement-own metrics to LE (relationship questions) if user has client operational access
            if (userIsClient) {
                const le = structurallyVisibleLEMap.get(e.clientLEId);
                if (le) rollupMetrics(le.metrics, ownMetrics);
            }

            // Effective progress metrics for Supplier Relationship (ownMetrics + applicable CQs for e.clientLEId)
            const rawEffectiveMetrics = { ...ownMetrics };
            const leCQs = leCommonQsMap.get(e.clientLEId) || [];
            leCQs.forEach(cq => {
                rollupMetrics(rawEffectiveMetrics, cq.metrics);
            });

            // Filter metrics for Supplier view if needed
            const finalMetrics = userIsSupplier ? {
                total: rawEffectiveMetrics.total,
                noData: rawEffectiveMetrics.noData,
                mapped: rawEffectiveMetrics.mapped,
                answered: rawEffectiveMetrics.answered,
                approved: rawEffectiveMetrics.approved,
                released: rawEffectiveMetrics.released
            } : rawEffectiveMetrics;

            // Rollup to FI if user is a supplier on this engagement
            if (userIsSupplier) {
                const fi = fiMap.get(e.fiOrgId);
                if (fi) rollupMetrics(fi.metrics, finalMetrics);
            }

            return {
                id: e.id,
                leName: getLEDisplayName(e.clientLE),
                clientId: owner?.partyId || '',
                clientName: owner?.party.name || 'Unknown Client',
                supplierName: e.org.name,
                status: e.status,
                fiOrgId: e.fiOrgId,
                clientLEId: e.clientLEId,
                userIsClient,
                userIsSupplier,
                metrics: finalMetrics,
                questionnaires: userIsSupplier ? e.questionnaireInstances : undefined
            };
        }));
    }

    // 4. Rollup LE metrics to Client Orgs ONCE per LE (ONLY for operationally visible LEs)
    context.legalEntities.forEach(le => {
        if (operationallyVisibleLEIds.has(le.id)) {
            const ownerName = le.clientName;
            const client = context.clients.find(c => c.name === ownerName);
            if (client) {
                rollupMetrics(client.metrics, le.metrics);
            }
        }
    });

    await attachV2QuestionStateMetrics(context, operationallyVisibleLEIds, operationallyVisibleEngagementIds);

    return context;
}

async function attachV2QuestionStateMetrics(
    context: DashboardContexts,
    operationallyVisibleLEIds: Set<string>,
    operationallyVisibleEngagementIds: Set<string>
): Promise<void> {
    const cqV2MetricsMap = new Map<string, QuestionStateMetrics>();
    await Promise.all(
        context.legalEntities.flatMap((le) =>
            (le.commonQuestionnaires || []).map(async (cq) => {
                const cqV2 = await calculateCQQuestionStateMetrics(cq.id, le.id);
                cq.v2Metrics = cqV2;
                cqV2MetricsMap.set(`${cq.id}:${le.id}`, cqV2);
            })
        )
    );

    const relOwnV2MetricsMap = new Map<string, QuestionStateMetrics>();
    await Promise.all(
        context.relationships.map(async (rel) => {
            const ownV2 = await calculateEngagementQuestionStateMetrics(rel.id);
            relOwnV2MetricsMap.set(rel.id, ownV2);

            const relEffectiveV2 = { ...ownV2 };
            const leCQs = (context.legalEntities.find((l) => l.id === rel.clientLEId)?.commonQuestionnaires) || [];
            leCQs.forEach((cq) => {
                if (cq.v2Metrics) {
                    rollupQuestionStateMetrics(relEffectiveV2, cq.v2Metrics);
                }
            });
            rel.v2Metrics = relEffectiveV2;
        })
    );

    context.legalEntities.forEach((le) => {
        const leV2 = emptyQuestionStateMetrics();
        if (operationallyVisibleLEIds.has(le.id)) {
            (le.commonQuestionnaires || []).forEach((cq) => {
                if (cq.v2Metrics) rollupQuestionStateMetrics(leV2, cq.v2Metrics);
            });
            context.relationships
                .filter((r) => r.clientLEId === le.id && r.userIsClient)
                .forEach((r) => {
                    const ownV2 = relOwnV2MetricsMap.get(r.id);
                    if (ownV2) rollupQuestionStateMetrics(leV2, ownV2);
                });
        }
        le.v2Metrics = leV2;
    });

    context.clients.forEach((client) => {
        const clientV2 = emptyQuestionStateMetrics();
        context.legalEntities
            .filter((le) => le.clientName === client.name && operationallyVisibleLEIds.has(le.id))
            .forEach((le) => {
                if (le.v2Metrics) rollupQuestionStateMetrics(clientV2, le.v2Metrics);
            });
        client.v2Metrics = clientV2;
    });

    context.financialInstitutions.forEach((fi) => {
        const fiV2 = emptyQuestionStateMetrics();
        const fiRels = context.relationships.filter((r) => r.fiOrgId === fi.id && r.userIsSupplier);

        fiRels.forEach((r) => {
            const ownV2 = relOwnV2MetricsMap.get(r.id);
            if (ownV2) rollupQuestionStateMetrics(fiV2, ownV2);
        });

        const uniqueLEIds = Array.from(new Set(fiRels.map((r) => r.clientLEId)));
        uniqueLEIds.forEach((leId) => {
            const leCQs = context.legalEntities.find((l) => l.id === leId)?.commonQuestionnaires || [];
            leCQs.forEach((cq) => {
                if (cq.v2Metrics) rollupQuestionStateMetrics(fiV2, cq.v2Metrics);
            });
        });

        fi.v2Metrics = fiV2;
    });
}
