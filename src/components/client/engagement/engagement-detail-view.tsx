"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Search, Plus, Filter, Download, ExternalLink, Clock, CheckCircle2, Sparkles, LayoutDashboard, FolderOpen, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AddQuestionnaireDialog } from "./add-questionnaire-dialog";
import { KanbanBoard } from "./kanban-board";
import { EngagementDocumentManager } from "./engagement-document-manager";
import { DueDateBadge } from "@/components/client/due-date-badge";

import { ProgressTracker } from "@/components/shared/progress-tracker";
import { DashboardMetric } from "@/lib/dashboard-metrics";
import { InviteSupplierDialog } from "./invite-supplier-dialog";

interface EngagementDetailViewProps {
    le: any;
    engagement: any;
    questionnaires: any[];
    sharedDocuments: any[];
    evidenceDocuments?: any[];
    initialTab?: string;
    metrics?: DashboardMetric;
    standingData?: any;
    invitations: any[];
    members: any[];
}

import { instantiateQuestionnaire, generateEngagementAnswers } from "@/actions/kanban-actions";
import { deleteQuestionnaire } from "@/actions/questionnaire"; // Import Delete action
import { revokeInvitation } from "@/actions/invitations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Settings, Trash2 } from "lucide-react";

import { QuestionnaireMapper } from "./questionnaire-mapper";

import { useSearchParams } from "next/navigation";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getRelationshipTabs } from "@/config/navigation-tabs";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export function EngagementDetailView({ le, engagement, questionnaires, sharedDocuments, evidenceDocuments = [], invitations, members, initialTab, metrics, standingData }: EngagementDetailViewProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [manageQuestionnaireId, setManageQuestionnaireId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Determine active tab from query param or initialTab prop
    const activeTab = searchParams.get('tab') || initialTab || "workbench";

    const relationshipTabs = getRelationshipTabs(le.id, engagement.id);

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

    const handleRevokeInvite = async (invitationId: string) => {
        if (!confirm("Are you sure you want to revoke this invitation?")) return;

        toast.promise(revokeInvitation(invitationId), {
            loading: "Revoking invitation...",
            success: () => {
                router.refresh();
                return "Invitation revoked";
            },
            error: "Failed to revoke invitation"
        });
    };

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs 
                items={[{ label: engagement.org.name }]} // The LE layout handles the parent trail
                title={engagement.org.name}
                typeLabel="Supplier Relationship"
                secondaryNav={<HeaderNavList items={relationshipTabs} />}
                isWide={activeTab === 'workbench'}
            />

            {/* In-Page Metadata Row (Optional, could also move to secondaryNav metadata slot later) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <DueDateBadge
                        id={engagement.id}
                        date={engagement.dueDate}
                        effectiveDate={engagement.dueDate || le.dueDate}
                        source={engagement.dueDate ? 'RELATIONSHIP' : 'LE'}
                        level="RELATIONSHIP"
                        label="Deadline"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                        onClick={() => setIsInviteDialogOpen(true)}
                    >
                        <Users className="h-4 w-4" />
                        Invite User
                    </Button>
                </div>
                {metrics && (
                    <div className="hidden md:block">
                        <ProgressTracker metrics={metrics} variant="header" />
                    </div>
                )}
            </div>

            {metrics && (
                <div className="md:hidden">
                    <Card>
                        <CardContent className="p-4 flex justify-center">
                            <ProgressTracker metrics={metrics} variant="header" />
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} className="w-full space-y-0">
                {/* Internal TabsContent remains, but TabsList is removed as it's now in the header */}
                <div className={cn(
                    "bg-white border border-slate-200 rounded-xl relative min-h-[600px]",
                    activeTab === "workbench" ? "p-0 md:p-4" : "p-0 md:p-8"
                )}>

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
                        {manageQuestionnaireId ? (
                            <QuestionnaireMapper
                                questionnaireId={manageQuestionnaireId}
                                onBack={() => setManageQuestionnaireId(null)}
                                standingData={standingData}
                            />
                        ) : (
                            <>
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
                                                {questionnaires.map((q: any) => (
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
                                                                    <span className="text-slate-300 text-[10px]">•</span>
                                                                    <DueDateBadge
                                                                        id={q.id}
                                                                        date={q.dueDate}
                                                                        effectiveDate={q.dueDate || engagement.dueDate || le.dueDate}
                                                                        source={q.dueDate ? 'QUESTIONNAIRE' : engagement.dueDate ? 'RELATIONSHIP' : 'LE'}
                                                                        level="QUESTIONNAIRE"
                                                                        label="Deadline"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button onClick={() => setManageQuestionnaireId(q.id)} variant="outline" size="sm">
                                                                <Settings className="h-4 w-4 mr-2" />
                                                                Manage
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteQuestionnaire(q.id, q.name)}>
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Remove
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="documents" className="mt-0">
                        <EngagementDocumentManager
                            engagementId={engagement.id}
                            documents={sharedDocuments || []}
                            evidenceDocuments={evidenceDocuments}
                        />
                    </TabsContent>

                    <TabsContent value="workbench" className="mt-6 md:mt-0 p-4 md:p-0">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium text-slate-900">Task Board</h3>
                                <p className="text-sm text-slate-500">Manage questions and track progress</p>
                            </div>
                            <Button onClick={handleBatchGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
                                <Sparkles className="h-4 w-4" />
                                Draft Answers for All
                            </Button>
                        </div>
                        <div className="min-h-[calc(100vh-250px)] w-full md:border md:rounded-lg bg-slate-50/50 md:p-4">
                            <KanbanBoard
                                key={refreshKey}
                                engagementId={engagement.id}
                                clientLEId={le.id}
                                fiName={engagement.org.name}
                                questionnaires={questionnaires}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="team" className="mt-0 space-y-6">
                        {/* Active Members Card */}
                        <Card>
                            <CardHeader className="pb-3 border-b border-slate-100 mb-4">
                                <CardTitle className="text-lg text-slate-800">Active Team Members</CardTitle>
                                <CardDescription>Users who have access to this engagement.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {members.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">No active members found.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {members.map((member: any) => (
                                            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                                                        {member.user.name ? member.user.name.charAt(0).toUpperCase() : member.user.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{member.user.name || 'Unknown User'}</p>
                                                        <p className="text-sm text-slate-500">{member.user.email}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-xs">{member.role}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Pending Invitations Card */}
                        <Card>
                            <CardHeader className="pb-3 border-b border-slate-100 mb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg text-slate-800">Pending Invitations</CardTitle>
                                        <CardDescription>Invitations sent but not yet accepted.</CardDescription>
                                    </div>
                                    <Button size="sm" onClick={() => setIsInviteDialogOpen(true)} variant="outline" className="gap-2">
                                        <Plus className="h-4 w-4" /> Invite
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {invitations.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">No pending invitations.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {invitations.map((invite: any) => (
                                            <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{invite.sentToEmail}</p>
                                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                            <Badge variant="outline" className="text-[10px] font-normal">{invite.role}</Badge>
                                                            <span>•</span>
                                                            <span>Sent by {invite.createdByUser?.name || invite.createdByUser?.email || 'Unknown'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRevokeInvite(invite.id)}
                                                >
                                                    Revoke
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

            <InviteSupplierDialog
                open={isInviteDialogOpen}
                onOpenChange={setIsInviteDialogOpen}
                engagementId={engagement.id}
                orgName={engagement.org.name}
            />


        </div>
    );
}
