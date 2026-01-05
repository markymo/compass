"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LEProjectSummary } from "./le-project-summary";
import { StandingDataManager } from "./standing-data-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowUpRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

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
    const pendingDocs = engagements.reduce((acc, eng) => acc + eng.questionnaires.length, 0);

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

            <Tabs value={activeTab} className="bg-transparent border-none shadow-none">
                <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border h-12 px-1 mb-6">
                    <TabsTrigger
                        active={activeTab === "dashboard"}
                        onClick={() => setActiveTab("dashboard")}
                        className="px-6 py-2"
                    >
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                        active={activeTab === "standing-data"}
                        onClick={() => setActiveTab("standing-data")}
                        className="px-6 py-2"
                    >
                        Standing Data
                    </TabsTrigger>
                    <TabsTrigger
                        active={activeTab === "engagements"}
                        onClick={() => setActiveTab("engagements")}
                        className="px-6 py-2"
                    >
                        Engagements
                    </TabsTrigger>
                </TabsList>

                <TabsContent active={activeTab === "dashboard"}>
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
                                <div className="absolute top-4 right-4 h-16 w-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                                    <CheckCircle2 className="h-8 w-8 text-white" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-all">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Pending Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <AlertCircle className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <span className="text-sm font-medium">Verify Bank Account Details</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Clock className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <span className="text-sm font-medium">Update Financial Statement (2025)</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-all">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Recent Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500">Today, 14:23</p>
                                    <p className="text-sm">Added "Barclays" as a new financial partner.</p>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800" />
                                    <p className="text-xs text-slate-500">Yesterday, 09:15</p>
                                    <p className="text-sm">Updated Governance structure data.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent active={activeTab === "standing-data"}>
                    <div className="bg-slate-50/30 dark:bg-slate-900/10 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <StandingDataManager
                            clientLEId={le.id}
                            requirements={requirements}
                            standingData={standingData}
                        />
                    </div>
                </TabsContent>

                <TabsContent active={activeTab === "engagements"}>
                    <div className="grid gap-4">
                        {engagements.map(eng => (
                            <Card key={eng.id} className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="h-12 w-12 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                            <Building2 className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{eng.org.name}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-[10px] uppercase">{eng.status}</Badge>
                                                <span className="text-slate-400 text-xs">•</span>
                                                <span className="text-xs text-slate-500">{eng.questionnaires.length} Questionnaires</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link href={`/app/le/${le.id}/requirements`} className="h-10 w-10 rounded-full border flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 transition-all">
                                        <ArrowUpRight className="h-5 w-5" />
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
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
