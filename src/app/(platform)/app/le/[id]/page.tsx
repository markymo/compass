import { getClientLEData, getDashboardMetrics } from "@/actions/client";
import { notFound } from "next/navigation";
import { EditableDescription } from "@/components/client/editable-description";
import { EditableLEI } from "@/components/client/editable-lei";
import { MissionControl } from "@/components/client/mission-control";

export default async function LEDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [data, metrics] = await Promise.all([
        getClientLEData(id),
        getDashboardMetrics(id)
    ]);

    if (!data) {
        return notFound();
    }

    const { le } = data;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Main Content Column (2/3) */}
                <div className="md:col-span-2 space-y-6">
                    <div className="flex flex-col gap-4">
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                            {le.name}
                        </h1>

                        <div className="max-w-2xl">
                            <EditableDescription leId={le.id} initialValue={(le as any).description} />
                            <div className="mt-4">
                                <EditableLEI
                                    leId={le.id}
                                    initialLei={(le as any).lei}
                                    initialFetchedAt={(le as any).gleifFetchedAt}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        {metrics ? (
                            <MissionControl
                                metrics={metrics}
                                leId={le.id}
                                engagements={(le as any).fiEngagements || []}
                            />
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
                                Metrics unavailable.
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Column (1/3) */}
                <div className="space-y-6">
                    {/* Placeholder for future widgets or stats */}
                </div>
            </div>
        </div>
    );
}
