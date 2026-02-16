"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth/index";
import {
    DashboardMetric,
    emptyMetrics,
    calculateEngagementMetrics,
    rollupMetrics
} from "@/lib/metrics-calc";

export type { DashboardMetric };

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

async function fetchClientChildren(clientNode: TreeItemFn, isAdmin: boolean, userId?: string) {
    // Fetch LEs for this client
    const whereClause: any = {
        owners: { some: { partyId: clientNode.id, endAt: null } },
        isDeleted: false,
    };

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
