"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LEProjectSummary } from "./le-project-summary";
import { StandingDataManager } from "./standing-data-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ArrowUpRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LEPortalContainerProps {
    le: any;
    schema: any;
    requirements: any[];
    standingData: Record<string, any>;
    progress: any;
    engagements: any[];
}

export function LEPortalContainer({ le, schema, requirements, standingData, progress, engagements }: LEPortalContainerProps) {
    const [activeTab, setActiveTab] = useState("dashboard");

    // Calculate metrics
    const openQueries = 0; // Placeholder until Query model is integrated
    const pendingDocs = engagements.reduce((acc, eng) => acc + (eng.questionnaires?.length || 0), 0);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <LEProjectSummary
                name={le.name}
                jurisdiction={le.jurisdiction}
                status={le.status}
                progress={progress}
                openQueries={openQueries}
                pendingDocs={pendingDocs}
            />

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border h-12 p-1 mb-6 flex">
                    <TabsTrigger value="dashboard" className="flex-1">
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="standing-data" className="flex-1">
                        Standing Data
                    </TabsTrigger>
                    <TabsTrigger value="engagements" className="flex-1">
                        Engagements
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="mt-0">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="bg-blue-600 border-none text-white overflow-hidden relative">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg opacity-90">Data Completion</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold">{Math.round((progress.filled / progress.total) * 100)}%</div>
                                <p className="text-sm opacity-80 mt-1">
                                    {progress.total - progress.filled} core fields remaining
                                </p>
                            </CardContent>
                            <div className="absolute top-4 right-4 h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-white" />
                            </div>
                        </Card>

                        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-500 text-sm font-bold uppercase tracking-wider">Pending Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-3 text-sm font-medium">
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                    <span>Verify Bank Account Details</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-medium opacity-60">
                                    <Clock className="h-4 w-4 text-blue-500" />
                                    <span>Update Financial Statement (2025)</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-500 text-sm font-bold uppercase tracking-wider">Recent Activity</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400">Today, 14:23</p>
                                    <p className="text-sm font-medium">Added "Barclays" as a new financial partner.</p>
                                </div>
                                <div className="space-y-1 opacity-60 font-medium">
                                    <p className="text-[10px] text-slate-400">Yesterday, 09:15</p>
                                    <p className="text-sm">Updated Governance structure data.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="standing-data" className="mt-0">
                    <div className="bg-slate-50/30 dark:bg-slate-900/10 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <StandingDataManager
                            clientLEId={le.id}
                            requirements={requirements}
                            standingData={standingData}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="engagements" className="mt-0">
                    <div className="grid gap-4">
                        {engagements.map(eng => {
                            const fiName = typeof eng.org === 'string' ? eng.org : eng.org?.name || "Unknown FI";
                            return (
                                <Card key={eng.id} className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className="h-12 w-12 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <Building2 className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{fiName}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] uppercase">{eng.status}</Badge>
                                                    <span className="text-slate-400 text-xs">•</span>
                                                    <span className="text-xs text-slate-500">{eng.questionnaires?.length || 0} Questionnaires</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link href={`/app/le/${le.id}/requirements`} title="View Requirements">
                                                <div className="h-10 w-10 rounded-full border flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400">
                                                    <ArrowUpRight className="h-5 w-5" />
                                                </div>
                                            </Link>
                                            <Link href={`/app/le/${le.id}/engagement-new/${eng.id}`}>
                                                <Button size="sm" variant="default" className="gap-2">
                                                    Open Workbench
                                                    <ArrowUpRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {engagements.length === 0 && (
                            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed">
                                <p className="text-slate-500">No active engagements found.</p>
                                <Link href={`/app/le/${le.id}/requirements`} className="mt-4 inline-block text-blue-600 hover:underline text-sm font-medium">
                                    Invite a partner &rarr;
                                </Link>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
