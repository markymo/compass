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

interface EngagementDetailViewProps {
    le: any;
    engagement: any;
    questionnaires: any[];
}

export function EngagementDetailView({ le, engagement, questionnaires }: EngagementDetailViewProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Mock handler for now
    const handleAdd = (type: string, data: any) => {
        console.log("Adding questionnaire:", type, data);
        setIsAddDialogOpen(false);
        // In real impl, would trigger server action or upload
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{engagement.org.name}</h1>
                    <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                        <span>Relationship Status:</span>
                        <Badge variant={engagement.status === 'ACTIVE' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                            {engagement.status}
                        </Badge>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Manage Team</Button>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Questionnaire
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="questionnaires" className="w-full">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="questionnaires">Questionnaires ({questionnaires.length})</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
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
                    {/* Toolbar */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder="Filter questionnaires..." className="pl-9" />
                        </div>
                        <Button variant="ghost" size="icon">
                            <Filter className="h-4 w-4 text-slate-500" />
                        </Button>
                    </div>

                    {/* List */}
                    <div className="grid gap-4">
                        {questionnaires.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                                <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                                <h3 className="font-medium text-slate-900">No questionnaires yet</h3>
                                <p className="text-slate-500 text-sm mb-4">Add a questionnaire to start sharing data.</p>
                                <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">Add Questionnaire</Button>
                            </div>
                        ) : (
                            questionnaires.map((q) => (
                                <Card key={q.id} className="hover:border-indigo-300 transition-colors">
                                    <div className="p-6 flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 p-2 bg-indigo-50 text-indigo-600 rounded">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">{q.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                                                        {q.mappings ? 'FI-Published' : 'Client-Digitized'}
                                                    </Badge>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Updated 2 days ago
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" className="h-8">
                                                <Download className="h-4 w-4 mr-2" />
                                                PDF
                                            </Button>
                                            <Link href={`#`}>
                                                <Button size="sm" variant="secondary">
                                                    Open Workbench
                                                    <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="px-6 pb-4 pt-0">
                                        {/* Progress Bar Mockup */}
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 w-[65%]"></div>
                                            </div>
                                            <span>65% Complete</span>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
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
            </Tabs>

            <AddQuestionnaireDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAdd={handleAdd}
            />
        </div>
    );
}
