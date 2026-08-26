import { DashboardContexts } from "@/actions/dashboard";
import { DashboardMetric, emptyMetrics, rollupMetrics } from "@/lib/dashboard-metrics";
import { QuestionStateMetrics, emptyQuestionStateMetrics, rollupQuestionStateMetrics } from "@/lib/metrics/question-state-types";
import { format } from "date-fns";

export type OrgType = "SUPPLIER" | "CLIENT" | "LAW_FIRM" | "SYSTEM";

export interface OrgChild {
    type: "le" | "engagement" | "questionnaire" | "client";
    id: string;
    leId?: string;
    name: string;
    subtitle?: string;
    status?: string;
    href: string;
    metrics: DashboardMetric;
    v2Metrics?: QuestionStateMetrics;
    children?: OrgChild[];
}

export interface OrgNode {
    id: string;
    name: string;
    orgType: OrgType;
    role: string;
    source?: "DIRECT" | "DERIVED";
    metrics: DashboardMetric;
    v2Metrics?: QuestionStateMetrics;
    children: OrgChild[];
}

export function reshapeContexts(ctx: DashboardContexts): OrgNode[] {
    const nodes: OrgNode[] = [];

    // 1. Client orgs
    const sortedClients = [...ctx.clients].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const client of sortedClients) {
        const les: OrgChild[] = ctx.legalEntities
            .filter((le: any) => le.clientName === client.name)
            .map((le: any) => {
                const isOperational = le.role !== "ADMIN_VISIBILITY";

                let leCommonQs: OrgChild[] = [];
                if (le.commonQuestionnaires && le.commonQuestionnaires.length > 0) {
                    const groupMetrics = emptyMetrics();
                    const groupV2Metrics = emptyQuestionStateMetrics();
                    for (const cq of le.commonQuestionnaires) {
                        rollupMetrics(groupMetrics, cq.metrics);
                        rollupQuestionStateMetrics(groupV2Metrics, cq.v2Metrics || emptyQuestionStateMetrics());
                    }

                    leCommonQs = [{
                        type: "questionnaire" as const,
                        id: `common-qs-${le.id}`,
                        leId: le.id,
                        name: "Common Questionnaires",
                        href: isOperational ? `/app/le/${le.id}/relationships` : "#",
                        metrics: groupMetrics,
                        v2Metrics: groupV2Metrics,
                    }];
                }

                const leEngagements: OrgChild[] = ctx.relationships
                    .filter((r: any) => r.clientLEId === le.id && r.userIsClient)
                    .map((r: any) => ({
                        type: "engagement" as const,
                        id: r.id,
                        leId: le.id,
                        name: r.supplierName,
                        status: r.status,
                        href: `/app/le/${r.clientLEId}/relationships?engagementId=${r.id}`,
                        metrics: r.metrics,
                        v2Metrics: r.v2Metrics || emptyQuestionStateMetrics(),
                    }));

                return {
                    type: "le" as const,
                    id: le.id,
                    leId: le.id,
                    name: le.name,
                    subtitle: le.role,
                    href: isOperational ? `/app/le/${le.id}` : "#",
                    metrics: le.metrics,
                    v2Metrics: le.v2Metrics || emptyQuestionStateMetrics(),
                    children: [...leCommonQs, ...leEngagements]
                };
            });

        nodes.push({
            id: client.id,
            name: client.name,
            orgType: "CLIENT",
            role: client.role,
            source: client.source,
            metrics: client.metrics,
            v2Metrics: client.v2Metrics || emptyQuestionStateMetrics(),
            children: les,
        });
    }

    // 2. Supplier orgs
    const sortedFIs = [...ctx.financialInstitutions].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const fi of sortedFIs) {
        const clientEngagementMap = new Map<string, typeof ctx.relationships>();

        ctx.relationships
            .filter((r: any) => r.fiOrgId === fi.id && r.userIsSupplier)
            .forEach((r: any) => {
                const clientId = r.clientId || r.clientName;
                if (!clientEngagementMap.has(clientId)) {
                    clientEngagementMap.set(clientId, []);
                }
                clientEngagementMap.get(clientId)!.push(r);
            });

        const clientNodes: OrgChild[] = Array.from(clientEngagementMap.entries()).map(([clientId, rels]) => {
            const clientName = rels[0].clientName;
            const clientMetrics = emptyMetrics();
            const clientV2 = emptyQuestionStateMetrics();

            const leNodes: OrgChild[] = rels.map((r: any) => {
                const questionnaires: OrgChild[] = (r.questionnaires || []).map((q: any) => ({
                    type: "questionnaire" as const,
                    id: q.id,
                    leId: r.clientLEId,
                    name: q.name,
                    subtitle: `Last updated ${format(new Date(q.updatedAt), "dd MMM yy")}`,
                    status: q.status,
                    href: `/app/s/${fi.id}/engagements/${r.id}?q=${q.id}`,
                    metrics: emptyMetrics(),
                    v2Metrics: emptyQuestionStateMetrics(),
                }));

                rollupMetrics(clientMetrics, r.metrics);
                if (r.v2Metrics) rollupQuestionStateMetrics(clientV2, r.v2Metrics);

                return {
                    type: "le" as const,
                    id: r.id,
                    leId: r.clientLEId,
                    name: r.leName,
                    subtitle: "Engagement",
                    status: r.status,
                    href: `/app/s/${fi.id}/engagements/${r.id}`,
                    metrics: r.metrics,
                    v2Metrics: r.v2Metrics || emptyQuestionStateMetrics(),
                    children: questionnaires
                };
            });

            return {
                type: "client" as const,
                id: clientId,
                name: clientName,
                subtitle: "Client Organization",
                href: "#",
                metrics: clientMetrics,
                v2Metrics: clientV2,
                children: leNodes
            };
        });

        nodes.push({
            id: fi.id,
            name: fi.name,
            orgType: "SUPPLIER",
            role: fi.role,
            metrics: fi.metrics,
            v2Metrics: fi.v2Metrics || emptyQuestionStateMetrics(),
            children: clientNodes,
        });
    }

    // 3. Law firms
    const sortedLawFirms = [...ctx.lawFirms].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const lf of sortedLawFirms) {
        nodes.push({
            id: lf.id,
            name: lf.name,
            orgType: "LAW_FIRM",
            role: lf.role,
            metrics: emptyMetrics(),
            v2Metrics: emptyQuestionStateMetrics(),
            children: [],
        });
    }

    return nodes;
}
