
import { getFIEngagementById } from "@/actions/fi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Clock, FileText, ArrowRight, AlertCircle, Shield, Home, Landmark, Building2, KanbanSquare, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { notFound } from "next/navigation";
import { EngagementRequirementsList } from "@/components/fi/engagement-requirements-list";
import { EngagementActions } from "@/components/fi/engagement-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIKanbanBoard } from "@/components/fi/engagement/fi-kanban-board";

export default async function FIEngagementOverviewPage({ params }: { params: Promise<{ id: string; engagementId: string }> }) {
    const { id, engagementId } = await params;
    const engagement = await getFIEngagementById(engagementId);

    if (!engagement) return notFound();

    // Mock progress logic for now
    const progress = 0;

    return (
        <div className="flex flex-col min-h-screen">
            <StandardPageHeader
                title={engagement.clientLE.name}
                typeLabel="Engagement"
                breadcrumbs={[
                    { label: "Home", href: "/app", icon: Home },
                    { label: engagement.org.name, href: `/app/s/${id}`, icon: Landmark },
                    { label: engagement.clientLE.name, icon: Building2 }
                ]}
                actions={
                    <div className="flex gap-2">
                        <EngagementActions engagementId={engagement.id} clientName={engagement.clientLE.name} />
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
                            <CheckCircle2 className="w-4 h-4" /> Approve Onboarding
                        </Button>
                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 self-center h-7">
                            {engagement.status || 'Active'}
                        </Badge>
                    </div>
                }
            />

            <div className="w-full max-w-7xl mx-auto px-6 py-8">
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-slate-100 p-1 rounded-lg border border-slate-200 inline-flex">
                        <TabsTrigger value="overview" className="gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600">
                            <LayoutDashboard className="h-4 w-4" /> Overview
                        </TabsTrigger>
                        <TabsTrigger value="workbench" className="gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600">
                            <KanbanSquare className="h-4 w-4" /> Workbench
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Status & Progress Bar */}
                        <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                                        <span className="font-semibold text-slate-900 capitalize">{engagement.status?.toLowerCase() || 'Pending'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SLA Target</span>
                                    <div className="flex items-center gap-2 text-slate-500 italic text-sm">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        SLA tracking pending...
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-slate-500">Overall Progress</span>
                                        <span className="text-indigo-600 italic">Calculation pending...</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* LEFT: Requirements Checklist */}
                            <div className="col-span-2">
                                <EngagementRequirementsList
                                    engagementId={id}
                                    questionnaires={engagement.questionnaires}
                                />
                            </div>

                            {/* RIGHT: Activity & Insights */}
                            <div className="space-y-6">
                                <Card className="border-slate-200 shadow-sm">
                                    <CardContent className="p-5">
                                        <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Latest Activity</h3>
                                        <div className="text-sm text-slate-500 italic">
                                            Activity feed functionality pending...
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-indigo-100 bg-indigo-50/50 shadow-sm">
                                    <CardContent className="p-5">
                                        <h3 className="font-bold text-indigo-900 mb-2 text-sm flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                            AI Insights
                                        </h3>
                                        <div className="text-sm text-indigo-800/70 italic mt-4">
                                            AI analysis functionality pending...
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="workbench" className="h-[70vh] animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <FIKanbanBoard
                            engagementId={engagement.id}
                            clientName={engagement.clientLE.name}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
