
import {
    getFIOganization,
    getFIEngagements,
    getFIWorkbenchData,
    getFITeamMembers,
    getFIDashboardStats,
    getFIQuestionnaires
} from "@/actions/fi";
import { Home, Landmark } from "lucide-react";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { notFound } from "next/navigation";
import { FIPortalContainer } from "@/components/fi/fi-portal-container";

import { BreadcrumbProvider, useBreadcrumbs } from "@/context/breadcrumb-context";

function FIDashboardHeader({ org }: { org: any }) {
    const { secondaryNav, pageTitle, pageTypeLabel } = useBreadcrumbs();
    
    return (
        <StandardPageHeader
            title={pageTitle || org.name}
            typeLabel={pageTypeLabel || "Financial Institution"}
            breadcrumbs={[
                { label: "Home", href: "/app", icon: Home },
                { label: org.name, icon: Landmark }
            ]}
            secondaryNav={secondaryNav}
        />
    );
}

export default async function FIDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [org, engagements, workbenchData, teamMembers, stats, questionnaires] = await Promise.all([
        getFIOganization(id),
        getFIEngagements(id),
        getFIWorkbenchData(id),
        getFITeamMembers(id),
        getFIDashboardStats(id),
        getFIQuestionnaires()
    ]);

    if (!org) return notFound();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <FIDashboardHeader org={org} />

            <FIPortalContainer
                org={org}
                engagements={engagements}
                workbenchData={workbenchData}
                teamMembers={teamMembers}
                stats={stats}
                questionnaires={questionnaires}
            />
        </div>
    );
}
