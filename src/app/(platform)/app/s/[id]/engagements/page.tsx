
import {
    getFIOganization,
    getFIEngagements,
} from "@/actions/fi";
import { Search } from "lucide-react";
import { EngagementList } from "@/components/fi/engagement-list";
import { DashboardFilterBar } from "@/components/fi/dashboard-filter-bar";

export default async function FIEngagementsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const { id } = await params;
    const org = await getFIOganization(id);
    const resolvedSearchParams = await searchParams;

    // 1. Fetch Engagements
    const allEngagements = await getFIEngagements(id);

    // 2. Extract Available Filters
    const availableQuestionnaires = Array.from(new Set(
        allEngagements.flatMap(e => e.questionnaires.map(q => q.name))
    )).sort();

    const availableClients = Array.from(new Set(
        allEngagements.map(e => e.clientLE.name)
    )).sort();

    // 3. Filter Engagements
    let engagements = allEngagements;
    const filterQ = resolvedSearchParams.questionnaire as string;
    const filterClient = resolvedSearchParams.client as string;

    if (filterQ && filterQ !== "all") {
        engagements = engagements.filter(e =>
            e.questionnaires.some(q => q.name === filterQ)
        );
    }

    if (filterClient && filterClient !== "all") {
        engagements = engagements.filter(e =>
            e.clientLE.name === filterClient
        );
    }

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 py-6">
            <div className="flex items-center justify-between px-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relationships</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage your connected clients and counterparties.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            placeholder="Search relationships..."
                            className="h-9 w-80 pl-9 pr-4 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="px-6">
                <DashboardFilterBar
                    availableQuestionnaires={availableQuestionnaires}
                    availableClients={availableClients}
                />
            </div>

            <div className="px-6">
                <EngagementList engagements={engagements} fiOrgId={id} />
            </div>
        </div>
    );
}
