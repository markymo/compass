export type DashboardMetric = {
    total: number;
    noData: number;
    mapped: number;
    answered: number;
    approved: number;
    released: number;
}

export function emptyMetrics(): DashboardMetric {
    return {
        total: 0, noData: 0, mapped: 0, answered: 0,
        approved: 0, released: 0
    };
}

export function rollupMetrics(parent: DashboardMetric, child: DashboardMetric) {
    if (child.total !== undefined) parent.total += child.total;
    if (child.noData !== undefined) parent.noData += child.noData;
    if (child.mapped !== undefined) parent.mapped += child.mapped;
    if (child.answered !== undefined) parent.answered += child.answered;
    if (child.approved !== undefined) parent.approved += child.approved;
    if (child.released !== undefined) parent.released += child.released;
}
