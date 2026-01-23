import { getClientLEData, getDashboardMetrics } from "@/actions/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database, Table as TableIcon, RefreshCcw, Check, Building2, ArrowUpRight, Home, Briefcase } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { EditableDescription } from "@/components/client/editable-description";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StandingDataWorkbench } from "@/components/client/standing-data-workbench";
import { MissionControl } from "@/components/client/mission-control";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { DocumentVault } from "@/components/client/document-vault";

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
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: (le as any).clientOrg?.name || "Client", href: `/app/clients/${le.clientOrgId}`, icon: Building2 },
                    { label: le.name, icon: Briefcase }
                ]}
                actions={<ClientLEActions leId={le.id} leName={le.name} />}
            />
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 p-8 w-full">

                <div className="flex flex-col gap-6">
                    <h1 className="text-5xl font-bold tracking-tight font-serif text-slate-900">
                        {le.name}
                    </h1>

                    <div className="max-w-3xl">
                        <EditableDescription leId={le.id} initialValue={(le as any).description} />
                    </div>
                </div>
                {/* Main Content Tabs */}
                <Tabs defaultValue="overview" className="space-y-0">
                    <TabsList className="bg-transparent p-0 flex justify-start h-auto gap-0.5 border-b-0 space-x-1">
                        <TabsTrigger
                            value="overview"
                            className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Overview
                        </TabsTrigger>

                        <TabsTrigger
                            value="standing-data"
                            className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                        >
                            <Database className="h-4 w-4" />
                            Knowledge Base
                        </TabsTrigger>

                        <TabsTrigger
                            value="documents"
                            className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                        >
                            <Library className="h-4 w-4" />
                            Digital Vault
                        </TabsTrigger>

                        <TabsTrigger
                            value="engagements"
                            className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                        >
                            <Building2 className="h-4 w-4" />
                            Engagements
                        </TabsTrigger>
                    </TabsList>

                    <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 relative min-h-[600px]">
                        <TabsContent value="overview" className="mt-0">
                            {metrics ? (
                                <MissionControl metrics={metrics} leId={le.id} engagements={(le as any).fiEngagements || []} />
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    Failed to load metrics.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="standing-data" className="mt-0">
                            <div className="bg-white rounded-b-xl rounded-tr-xl min-h-[600px] p-8">
                                <StandingDataWorkbench leId={id} />
                            </div>
                        </TabsContent>

                        <TabsContent value="documents" className="mt-0">
                            <div className="bg-white rounded-b-xl rounded-tr-xl min-h-[600px] p-8">
                                <DocumentVault leId={id} />
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
        </div >
    );
}
