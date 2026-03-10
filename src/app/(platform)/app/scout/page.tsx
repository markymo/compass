import { Suspense } from "react";
import { getDashboardTree } from "@/actions/dashboard-tree";
import { DashboardTree } from "@/components/dashboard/dashboard-tree";
import { Loader2, Home, Search } from "lucide-react";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";

export const metadata = {
    title: "Scout | Compass",
    description: "Hierarchical view of your universe",
};

export default async function ScoutPage() {
    return (
        <div className="h-full flex flex-col">
            <StandardPageHeader
                title="Scout"
                typeLabel="Explorer"
                subtitle="Hierarchical overview of all your organizations and projects."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }, { label: "Scout", icon: Search }]}
            />

            <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
                <Suspense fallback={<TreeSkeleton />}>
                    <DashboardTreeLoader />
                </Suspense>
            </div>
        </div>
    );
}

async function DashboardTreeLoader() {
    const items = await getDashboardTree();
    return <DashboardTree items={items} />;
}

function TreeSkeleton() {
    return (
        <div className="w-full border rounded-xl bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500">Loading hierarchy...</span>
            </div>
            <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
        </div>
    );
}
