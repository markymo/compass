"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Search, Plus, Filter, Download, ExternalLink, Clock, CheckCircle2, Sparkles, LayoutDashboard, FolderOpen, Users } from "lucide-react";
import Link from "next/link";
import { AddQuestionnaireDialog } from "./add-questionnaire-dialog";
import { KanbanBoard } from "./kanban-board";
import { EngagementDocumentManager } from "./engagement-document-manager";

interface EngagementDetailViewProps {
    le: any;
    engagement: any;
    questionnaires: any[];
    sharedDocuments: any[];
    initialTab?: string;
}

import { instantiateQuestionnaire, generateEngagementAnswers } from "@/actions/kanban-actions";
import { deleteQuestionnaire } from "@/actions/questionnaire"; // Import Delete action
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function EngagementDetailView({ le, engagement, questionnaires, sharedDocuments, initialTab }: EngagementDetailViewProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();

    const handleAdd = async (type: string, data: any) => {
        if (type === 'library') {
            toast.info("Instantiating questionnaire...");
            const result = await instantiateQuestionnaire(data.templateId, engagement.id, data.name);
            if (result.success) {
                toast.success("Questionnaire added");
                setIsAddDialogOpen(false);
                router.refresh();
            } else {
                toast.error("Failed to add questionnaire");
            }
        } else {
            toast.info("Upload not implemented yet");
            setIsAddDialogOpen(false);
        }
    };

    const handleDeleteQuestionnaire = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove "${name}" from this engagement?`)) return;

        toast.promise(deleteQuestionnaire(id), {
            loading: "Removing questionnaire...",
            success: () => {
                router.refresh();
                return "Questionnaire removed";
            },
            error: "Failed to remove questionnaire"
        });
    };

    const handleBatchGenerate = async () => {
        toast.promise(
            async () => {
                const res = await generateEngagementAnswers(engagement.id);
                if (!res.success) throw new Error(res.error);
                return res;
            },
            {
                loading: 'Analyzing Knowledge Base and drafting answers...',
                success: (data: any) => {
                    router.refresh();
                    setRefreshKey(prev => prev + 1); // Force board reload
                    return `Drafted answers for ${data.count} questions via AI`;
                },
                error: (err) => `Failed: ${err.message}`
            }
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{engagement.org.name}</h1>
                </div>

            </div>

            <Tabs defaultValue={initialTab || "workbench"} className="w-full space-y-0">
                <TabsList className="bg-transparent p-0 flex justify-start h-auto gap-0.5 border-b-0 space-x-1">
                    <TabsTrigger
                        value="overview"
                        className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="workbench"
                        className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Sparkles className="h-4 w-4" />
                        Workbench
                    </TabsTrigger>
                    <TabsTrigger
                        value="manage"
                        className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <FileText className="h-4 w-4" />
                        Manage Engagement
                    </TabsTrigger>
                    <TabsTrigger
                        value="documents"
                        className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <FolderOpen className="h-4 w-4" />
                        Documents
                    </TabsTrigger>
                    <TabsTrigger
                        value="team"
                        className="relative gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Users className="h-4 w-4" />
                        Team
                    </TabsTrigger>
                </TabsList>

                <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 relative min-h-[600px]">

                    <TabsContent value="overview" className="mt-0">
                        <Card>
                            <CardHeader>
                                <CardTitle>Relationship Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-500">History and contact details coming soon...</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="manage" className="mt-0 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Questionnaires</h2>
                            <Button onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Questionnaire
                            </Button>
                        </div>

                        <Card>
                            <CardContent className="p-0">
                                {questionnaires.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                                        <h3 className="font-medium text-slate-900">No questionnaires linked</h3>
                                        <p className="text-slate-500 text-sm mb-4">Link a questionnaire to this engagement to start tracking answers.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {questionnaires.map((q) => (
                                            <div key={q.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-slate-900">{q.name}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {q.status === 'DIGITIZING' ? (
                                                                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse">
                                                                    Digitizing...
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {q.mappings ? 'Standard' : 'Custom'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeleteQuestionnaire(q.id, q.name)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="documents" className="mt-0">
                        <EngagementDocumentManager
                            engagementId={engagement.id}
                            documents={sharedDocuments || []}
                        />
                    </TabsContent>

                    <TabsContent value="workbench" className="mt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium text-slate-900">Task Board</h3>
                                <p className="text-sm text-slate-500">Manage questions and track progress</p>
                            </div>
                            <Button onClick={handleBatchGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
                                <Sparkles className="h-4 w-4" />
                                Draft Answers for All
                            </Button>
                        </div>
                        <div className="min-h-[calc(100vh-250px)] w-full border rounded-lg bg-slate-50/50 p-4">
                            <KanbanBoard
                                key={refreshKey}
                                engagementId={engagement.id}
                                fiName={engagement.org.name}
                                questionnaires={questionnaires}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="team" className="mt-0">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Members</CardTitle>
                                <CardDescription>Manage access to this engagement.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-500 text-sm">Team management functionality coming soon.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>

            <AddQuestionnaireDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAdd={handleAdd}
                engagementId={engagement.id}
            />
        </div>
    );
}
