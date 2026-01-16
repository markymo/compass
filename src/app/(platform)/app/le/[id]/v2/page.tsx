import { getClientLEData, getDashboardMetrics } from "@/actions/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database, Table as TableIcon, RefreshCcw, Check, Building2, ArrowUpRight } from "lucide-react";
import { EditableDescription } from "@/components/client/editable-description";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionnaireLibrary } from "@/components/client/questionnaire-library";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StandingDataWorkbench } from "@/components/client/standing-data-workbench";
import { MissionControl } from "@/components/client/mission-control";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";

export default async function LEDashboardV2Page({ params }: { params: Promise<{ id: string }> }) {
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
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="space-y-4">
                <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link href="/app/le" className="hover:text-slate-900 transition-colors">
                        Client Dashboard
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-slate-900 font-medium">{le.name}</span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold ml-2">V2 PROTOTYPE</span>
                </nav>

                <div className="flex flex-col gap-6">
                    <h1 className="text-5xl font-bold tracking-tight font-serif text-slate-900">
                        {le.name}
                    </h1>

                    <div className="max-w-3xl">
                        <EditableDescription leId={le.id} initialValue={(le as any).description} />
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-0">
                <TabsList className="bg-transparent p-0 flex justify-start h-auto gap-0.5 border-b-0 space-x-1">
                    <TabsTrigger
                        value="overview"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="library"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Library className="h-4 w-4" />
                        Selected Questionnaires
                    </TabsTrigger>
                    <TabsTrigger
                        value="standing-data"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        Standing Data
                    </TabsTrigger>
                    <TabsTrigger
                        value="engagements"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Building2 className="h-4 w-4" />
                        Engagements
                    </TabsTrigger>
                </TabsList>

                <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 relative min-h-[600px]">
                    <TabsContent value="overview" className="mt-0">
                        {metrics ? (
                            <MissionControl metrics={metrics} />
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                Failed to load metrics.
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="library" className="mt-0">
                        <QuestionnaireLibrary leId={id} />
                    </TabsContent>



                    <TabsContent value="standing-data" className="mt-0">
                        <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 min-h-[600px]">
                            <StandingDataWorkbench leId={id} />
                        </div>
                    </TabsContent>

                    <TabsContent value="engagements" className="mt-0">
                        <EngagementManager
                            leId={le.id}
                            initialEngagements={(le as any).fiEngagements || []}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
