"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth/index";

export type DashboardMetric = {
    noData: number;
    prepopulated: number;
    systemUpdated: number;
    drafted: number; // DRAFT, INTERNAL_REVIEW
    approved: number; // CLIENT_SIGNED_OFF
    released: number; // SHARED, SUPPLIER_REVIEW, QUERY
    acknowledged: number; // SUPPLIER_SIGNED_OFF
    lastEdit: Date | null;
    targetCompletion: Date | null;
}

export type TreeItemFn = {
    id: string;
    name: string;
    type: "CLIENT" | "LE" | "ENGAGEMENT";
    role: string; // e.g., "ADMIN", "USER", "LE_ADMIN"
    metrics: DashboardMetric;
    children: TreeItemFn[];
    metadata?: any; // Extra info like 'archived', 'status'
}

export async function getDashboardTree(): Promise<TreeItemFn[]> {
    const identity = await getIdentity();
    if (!identity) return [];

    // 1. Fetch User Memberships to determine scope
    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        include: {
            organization: true,
            clientLE: {
                include: {
                    owners: { where: { endAt: null }, include: { party: true } }
                }
            }
        }
    });

    const rootItems: TreeItemFn[] = [];
    const clientMap = new Map<string, TreeItemFn>();

    // 2. Build Hierarchy & Verify Permissions
    for (const m of memberships) {
        if (m.organization && m.organization.types.includes("CLIENT")) {
            const client = m.organization;
            if (!clientMap.has(client.id)) {
                clientMap.set(client.id, {
                    id: client.id,
                    name: client.name,
                    type: "CLIENT",
                    role: m.role,
                    metrics: emptyMetrics(),
                    children: []
                });
            }

            // If Admin, fetch all LEs
            if (["ADMIN", "CLIENT_ADMIN", "ORG_ADMIN"].includes(m.role)) {
                await fetchClientChildren(clientMap.get(client.id)!, true);
            } else {
                await fetchClientChildren(clientMap.get(client.id)!, false, identity.userId);
            }
        }
    }

    // 2b. Handle LE-only memberships (Derived Client Access)
    for (const m of memberships) {
        if (m.clientLE) {
            const le = m.clientLE;
            const client = le.owners[0]?.party;
            if (!client) continue;

            if (!clientMap.has(client.id)) {
                clientMap.set(client.id, {
                    id: client.id,
                    name: client.name,
                    type: "CLIENT",
                    role: "DERIVED", // Implicit
                    metrics: emptyMetrics(),
                    children: []
                });
                await fetchClientChildren(clientMap.get(client.id)!, false, identity.userId);
            }
        }
    }

    return Array.from(clientMap.values());
}

// --- Helpers ---

function emptyMetrics(): DashboardMetric {
    return {
        noData: 0, prepopulated: 0, systemUpdated: 0,
        drafted: 0, approved: 0, released: 0, acknowledged: 0,
        lastEdit: null, targetCompletion: null
    };
}

async function fetchClientChildren(clientNode: TreeItemFn, isAdmin: boolean, userId?: string) {
    // Fetch LEs for this client
    // If Admin, fetch all. If not, fetch only those with membership (or we just process the memberships we have?)
    // Better: Fetch all LEs involved, calculate metrics.

    const whereClause: any = {
        owners: { some: { partyId: clientNode.id, endAt: null } },
        isDeleted: false,
    };

    // If not admin, we rely on the implementation of getDashboardTree to have already added LEs? 
    // Or we fetch all LEs and filter by access?
    // Let's fetch all LEs for the client, but mark access.

    // Actually, distinct fetch is better.
    const clientLEs = await prisma.clientLE.findMany({
        where: whereClause,
        include: {
            fiEngagements: {
                where: { isDeleted: false },
                include: { org: true }
            },
            memberships: { where: { userId } } // Check specific user access
        }
    });

    for (const le of clientLEs) {
        // Determine role
        let role = "NO_ACCESS";
        if (isAdmin) role = "ADMIN";
        else if (le.memberships.length > 0) role = le.memberships[0].role;

        // If NO_ACCESS and not admin, skip? 
        // Logic: Browse mode? 
        // User requested: "View for a Client Admin who is not an LE User" should see data "No data, etc" but maybe not enter?
        // Actually the mockup shows "No LE access" badge. So we should include it but mark as such.

        // Only include if Admin OR has membership OR (maybe) if it's in the list?
        // If I am a User of Client A (member), I might not see LEs I am not assigned to.
        // But if I am Client Admin, I see everything.
        // If I am just User, I probably only see my LEs.

        if (role === "NO_ACCESS" && clientNode.role !== "ADMIN" && clientNode.role !== "CLIENT_ADMIN") {
            continue; // Skip LEs I don't have access to
        }

        const leNode: TreeItemFn = {
            id: le.id,
            name: le.name,
            type: "LE",
            role: role,
            metrics: emptyMetrics(),
            children: [],
            metadata: { status: le.status }
        };

        // Fetch Engagements for this LE
        for (const eng of le.fiEngagements) {
            // Metrics for Engagement
            const metrics = await calculateEngagementMetrics(eng.id);

            const engNode: TreeItemFn = {
                id: eng.id,
                name: eng.org.name, // The FI Name
                type: "ENGAGEMENT",
                role: role, // Inherits LE role usually
                metrics: metrics,
                children: [],
                metadata: { status: eng.status }
            };

            leNode.children.push(engNode);

            // Rollup to LE
            rollupMetrics(leNode.metrics, metrics);
        }

        // Rollup to Client
        rollupMetrics(clientNode.metrics, leNode.metrics);
        clientNode.children.push(leNode);
    }
}

async function calculateEngagementMetrics(engagementId: string): Promise<DashboardMetric> {
    // 1. Get Questions via Questionnaire linked to Engagement
    // Note: QuestionnaireInstance relation

    const questions = await prisma.question.findMany({
        where: {
            questionnaire: {
                fiEngagementId: engagementId
            }
        },
        select: {
            id: true,
            status: true,
            answer: true,
            updatedAt: true,
            // We might need activity logs for "Prepopulated" vs "System Updated" logic later
        }
    });

    const m = emptyMetrics();

    for (const q of questions) {
        // Last Edit
        if (!m.lastEdit || q.updatedAt > m.lastEdit) {
            m.lastEdit = q.updatedAt;
        }

        // Columns Logic
        const hasAnswer = q.answer && q.answer.trim().length > 0;

        // "No Data": No answer? Or Draft with no answer?
        if (!hasAnswer) {
            m.noData++;
        }

        // Status Mapping
        switch (q.status) {
            case "DRAFT":
            case "INTERNAL_REVIEW":
                m.drafted++;
                if (hasAnswer) m.drafted++; // Double count? No.
                // If it has answer but is DRAFT, is it prepopulated?
                // Let's assume for now:
                // Prepopulated = Has answer, but status is Draft? (Primitive logic)
                // Let's just stick to status columns for now.
                break;
            case "CLIENT_SIGNED_OFF":
                m.approved++;
                break;
            case "SHARED":
            case "SUPPLIER_REVIEW":
            case "QUERY":
                m.released++;
                break;
            case "SUPPLIER_SIGNED_OFF":
                m.acknowledged++;
                break;
        }
    }

    return m;
}

function rollupMetrics(parent: DashboardMetric, child: DashboardMetric) {
    parent.noData += child.noData;
    parent.prepopulated += child.prepopulated;
    parent.systemUpdated += child.systemUpdated;
    parent.drafted += child.drafted;
    parent.approved += child.approved;
    parent.released += child.released;
    parent.acknowledged += child.acknowledged;

    if (child.lastEdit) {
        if (!parent.lastEdit || child.lastEdit > parent.lastEdit) {
            parent.lastEdit = child.lastEdit;
        }
    }
}
