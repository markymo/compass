"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Search, Plus, Filter, Download, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AddQuestionnaireDialog } from "./add-questionnaire-dialog";
import { KanbanBoard } from "./kanban-board";

interface EngagementDetailViewProps {
    le: any;
    engagement: any;
    questionnaires: any[];
}

import { instantiateQuestionnaire } from "@/actions/kanban-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function EngagementDetailView({ le, engagement, questionnaires }: EngagementDetailViewProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{engagement.org.name}</h1>
                </div>

            </div>

            <Tabs defaultValue="workbench" className="w-full">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="questionnaires">Questionnaires ({questionnaires.length})</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="workbench">Workbench</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Relationship Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-500">History and contact details coming soon...</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="questionnaires" className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-slate-900">Active Questionnaires</h2>
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
                                                    <Badge variant="secondary" className="mt-1 text-[10px]">
                                                        {q.mappings ? 'Standard' : 'Custom'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
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

                <TabsContent value="documents" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shared Documents</CardTitle>
                            <CardDescription>Other files shared with this FI.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-500 text-sm">No documents found.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="workbench" className="mt-6">
                    <div className="h-[600px] w-full border rounded-lg bg-slate-50/50 p-4">
                        <KanbanBoard engagementId={engagement.id} />
                    </div>
                </TabsContent>
            </Tabs>

            <AddQuestionnaireDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAdd={handleAdd}
            />
        </div>
    );
}
