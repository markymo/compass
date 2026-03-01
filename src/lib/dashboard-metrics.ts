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

export function emptyMetrics(): DashboardMetric {
    return {
        noData: 0, prepopulated: 0, systemUpdated: 0,
        drafted: 0, approved: 0, released: 0, acknowledged: 0,
        lastEdit: null, targetCompletion: null
    };
}

export function rollupMetrics(parent: DashboardMetric, child: DashboardMetric) {
    if (child.noData !== undefined) parent.noData += child.noData;
    if (child.prepopulated !== undefined) parent.prepopulated += child.prepopulated;
    if (child.systemUpdated !== undefined) parent.systemUpdated += child.systemUpdated;
    if (child.drafted !== undefined) parent.drafted += child.drafted;
    if (child.approved !== undefined) parent.approved += child.approved;
    if (child.released !== undefined) parent.released += child.released;
    if (child.acknowledged !== undefined) parent.acknowledged += child.acknowledged;

    if (child.lastEdit) {
        if (!parent.lastEdit || child.lastEdit > parent.lastEdit) {
            parent.lastEdit = child.lastEdit;
        }
    }

    if (child.targetCompletion) {
        if (!parent.targetCompletion || child.targetCompletion < parent.targetCompletion) {
            parent.targetCompletion = child.targetCompletion;
        }
    }
}
