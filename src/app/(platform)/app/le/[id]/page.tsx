import { getClientLEData, getDashboardMetrics } from "@/actions/client";
import { notFound } from "next/navigation";
import { MissionControl, ActivityFeed } from "@/components/client/mission-control";
import { getRecentLEActivity } from "@/lib/le-activity";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";
import { LEUsersTab } from "@/components/client/le-users-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function LEDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [data, metrics, activity] = await Promise.all([
        getClientLEData(id),
        getDashboardMetrics(id),
        getRecentLEActivity(id, 15),
    ]);

    if (!data) {
        return notFound();
    }

    const { le } = data;

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            <SetPageBreadcrumbs 
                items={[]} 
                title={undefined} 
                typeLabel={undefined} 
            />
            <div className="pt-0">
                {metrics ? (
                    <MissionControl
                        metrics={metrics}
                        leId={le.id}
                        engagements={(le as any).fiEngagements || []}
                        activity={activity}
                    />
                ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
                        Metrics unavailable.
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-200">
                <EngagementManager
                    leId={le.id}
                    initialEngagements={(le as any).fiEngagements || []}
                    leDueDate={(le as any).dueDate}
                />
            </div>

            <div className="pt-4 border-t border-slate-200">
                <LEUsersTab leId={le.id} />
            </div>

            <div className="pt-4 border-t border-slate-200">
                <ActivityFeed activity={activity} />
            </div>
        </div>
    );
}
