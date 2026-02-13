import { getClientLEData, getDashboardMetrics, checkIsSystemAdmin } from "@/actions/client";
import { getIdentity } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database, Table as TableIcon, RefreshCcw, Check, Building2, ArrowUpRight, Home, Briefcase, Globe, Terminal } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { EditableDescription } from "@/components/client/editable-description";
import { EditableLEI } from "@/components/client/editable-lei";
import { GleifTab } from "@/components/client/gleif-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StandingDataWorkbench } from "@/components/client/standing-data-workbench";
import { MissionControl } from "@/components/client/mission-control";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { DocumentVault } from "@/components/client/document-vault";
import { DataSchemaTab } from "@/components/client/data-schema-tab";

import { LEConsole } from "@/components/client/le-console";
import { LEUsersTab } from "@/components/client/le-users-tab";
import { Users } from "lucide-react";

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

    // Check for System Admin Permission
    const identity = await getIdentity();
    const isSystemAdmin = identity?.userId ? await checkIsSystemAdmin(identity.userId) : false;

    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: (le as any).owners?.[0]?.party?.name || "Client", href: `/app/clients/${(le as any).owners?.[0]?.partyId}`, icon: Building2 },
                    { label: le.name, icon: Briefcase }
                ]}
                actions={<ClientLEActions leId={le.id} leName={le.name} isSystemAdmin={isSystemAdmin} />}
            />
            <div className="max-w-6xl mx-auto space-y-8 p-8 w-full">

                <div className="flex flex-col gap-6">
                    <h1 className="text-5xl font-bold tracking-tight font-serif text-slate-900">
                        {le.name}
                    </h1>

                    <div className="max-w-3xl">
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
                {/* Main Content Tabs */}
                <Tabs defaultValue="overview" className="space-y-0">
                    <TabsList className="w-full justify-start border-b border-slate-200 bg-white/50 backdrop-blur-xl rounded-t-xl rounded-b-none h-auto p-0 z-10 sticky top-[73px]">
                        <TabsTrigger value="overview" className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="gleif" className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            GLEIF
                        </TabsTrigger>
                        <TabsTrigger value="data-schema" className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2">
                            <TableIcon className="h-4 w-4" />
                            Data Schema
                        </TabsTrigger>
                        <TabsTrigger value="standing-data" className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Knowledge Base
                        </TabsTrigger>

                        <TabsTrigger value="console" className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-purple-600" />
                            Console
                        </TabsTrigger>

                        <TabsTrigger
                            value="documents"
                            className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2"
                        >
                            <Library className="h-4 w-4" />
                            Digital Vault
                        </TabsTrigger>

                        <TabsTrigger
                            value="engagements"
                            className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2"
                        >
                            <Building2 className="h-4 w-4" />
                            Supplier Relationships
                        </TabsTrigger>

                        <TabsTrigger
                            value="users"
                            className="px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent flex items-center gap-2"
                        >
                            <Users className="h-4 w-4" />
                            Users
                        </TabsTrigger>
                    </TabsList>

                    <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 relative min-h-[600px]">
                        <TabsContent value="overview" className="m-0 bg-transparent">
                            {/* Overview Content */}
                            {metrics ? (
                                <MissionControl metrics={metrics} leId={le.id} engagements={(le as any).fiEngagements || []} />
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    Failed to load metrics.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="gleif" className="m-0 bg-transparent py-6">
                            <GleifTab
                                data={{
                                    ...(le as any).gleifData,
                                    nationalRegistryData: (le as any).nationalRegistryData
                                }}
                                fetchedAt={(le as any).gleifFetchedAt}
                            />
                        </TabsContent>

                        <TabsContent value="data-schema" className="m-0 bg-transparent py-6">
                            <div className="bg-white rounded-b-xl rounded-tr-xl min-h-[600px] p-8">
                                <DataSchemaTab
                                    leId={le.id}
                                    identityProfile={(le as any).identityProfile}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="standing-data" className="m-0 bg-transparent">
                            <div className="bg-white rounded-b-xl rounded-tr-xl min-h-[600px] p-8">
                                <StandingDataWorkbench leId={id} />
                            </div>
                        </TabsContent>

                        <TabsContent value="console" className="m-0 bg-transparent">
                            <LEConsole leId={le.id} />
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
