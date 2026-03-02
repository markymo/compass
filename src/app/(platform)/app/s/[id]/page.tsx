
import {
    getFIOganization,
    getFIEngagements,
    getFIWorkbenchData,
    getFITeamMembers,
    getFIDashboardStats,
    getFIQuestionnaires
} from "@/actions/fi";
import { Home, Landmark } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { notFound } from "next/navigation";
import { FIPortalContainer } from "@/components/fi/fi-portal-container";

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
            <GuideHeader
                breadcrumbs={[
                    { label: "", href: "/app", icon: Home },
                    { label: org.name, icon: Landmark }
                ]}
            />

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
