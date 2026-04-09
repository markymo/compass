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
import { OutputPackBuilder } from "./output-pack-builder";
import { DueDateBadge } from "@/components/client/due-date-badge";

import { ProgressTracker } from "@/components/shared/progress-tracker";
import { DashboardMetric } from "@/lib/dashboard-metrics";
import { InviteSupplierDialog } from "./invite-supplier-dialog";
import { ShareQuestionnaireDialog } from "../questionnaire/share-questionnaire-dialog";

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
    manageQuestionnaireId?: string;
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
import { getRelationshipTabs, getQuestionnaireTabs } from "@/config/navigation-tabs";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export function EngagementDetailView({ le, engagement, questionnaires, sharedDocuments, evidenceDocuments = [], invitations, members, initialTab, metrics, standingData, manageQuestionnaireId: propsManageQuestionnaireId }: EngagementDetailViewProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [shareTarget, setShareTarget] = useState<{ id: string, name: string } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Determine active tab from query param or initialTab prop (defaulting to manage)
    const activeTab = searchParams.get('tab') || initialTab || "manage";

    // Support both prop and state for manageQuestionnaireId during transition/fallback
    // though prefer URL routing now
    const manageQuestionnaireId = propsManageQuestionnaireId;

    const relationshipTabs = getRelationshipTabs(le.id, engagement.id);
    const questionnaireTabs = getQuestionnaireTabs(le.id, engagement.id, manageQuestionnaireId || "");

    // Contextual Data for Active Questionnaire
    const activeQuestionnaire = manageQuestionnaireId ? questionnaires.find(q => q.id === manageQuestionnaireId) : null;
    const currentTabs = manageQuestionnaireId ? questionnaireTabs : relationshipTabs;
    const currentTitle = activeQuestionnaire ? activeQuestionnaire.name : engagement.org.name;
    const currentTypeLabel = activeQuestionnaire ? "Supplier Relationship Questionnaire" : "Supplier Relationship";

    // Build breadcrumbs dynamically
    const breadcrumbItems = [
        { 
            label: engagement.org.name, 
            href: activeQuestionnaire ? `/app/le/${le.id}/engagement-new/${engagement.id}` : undefined,
            iconName: "link-2" 
        }
    ];

    if (activeQuestionnaire) {
        breadcrumbItems.push({
            label: activeQuestionnaire.name,
            iconName: "clipboard-list"
        } as any);
    }

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
                items={breadcrumbItems}
                title={currentTitle}
                typeLabel={currentTypeLabel}
                secondaryNav={<HeaderNavList items={currentTabs} />}
            />

            {/* In-Page Metadata Row (Optional, could also move to secondaryNav metadata slot later) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <DueDateBadge
                        id={activeQuestionnaire?.id || engagement.id}
                        date={activeQuestionnaire?.dueDate || engagement.dueDate}
                        effectiveDate={activeQuestionnaire?.dueDate || engagement.dueDate || le.dueDate}
                        source={activeQuestionnaire ? 'QUESTIONNAIRE' : engagement.dueDate ? 'RELATIONSHIP' : 'LE'}
                        level={activeQuestionnaire ? 'QUESTIONNAIRE' : 'RELATIONSHIP'}
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
                    <div className="flex-1 w-full md:w-auto">
                        <ProgressTracker metrics={metrics} variant={"v2" as any} className="w-full" />
                    </div>
                )}
            </div>


            <Tabs value={activeTab} className="w-full space-y-0">
                {/* Internal TabsContent remains, but TabsList is removed as it's now in the header */}
                <div className={cn(
                    "bg-white border border-slate-200 rounded-xl relative min-h-[600px] p-0 md:p-8"
                )}>



                    <TabsContent value="manage" className="mt-0 space-y-4">
                        {manageQuestionnaireId ? (
                            <QuestionnaireMapper
                                questionnaireId={manageQuestionnaireId}
                                onBack={() => router.push(`/app/le/${le.id}/engagement-new/${engagement.id}`)}
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
                                                    <Link 
                                                        key={q.id} 
                                                        href={`/app/le/${le.id}/engagement-new/${engagement.id}/questionnaire/${q.id}`}
                                                        className="p-6 flex flex-col gap-4 hover:bg-slate-50/80 cursor-pointer transition-colors group/card"
                                                    >
                                                         {/* Line 1: Name and Due Date */}
                                                         <div className="flex items-center justify-between gap-4">
                                                             <div className="flex items-center gap-4">
                                                                 <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center shrink-0">
                                                                     <FileText className="h-5 w-5" />
                                                                 </div>
                                                                 <div className="flex flex-col gap-1">
                                                                     <h3 className="font-semibold text-lg text-slate-900 group-hover/card:text-indigo-600 transition-colors leading-none">{q.name}</h3>
                                                                     {q.status === 'DIGITIZING' && (
                                                                         <Badge variant="outline" className="w-fit text-[10px] h-4 py-0 bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse">
                                                                             Digitizing...
                                                                         </Badge>
                                                                     )}
                                                                 </div>
                                                             </div>
                                                             <div className="shrink-0">
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

                                                         {/* Line 2: Metrics and Actions */}
                                                        <div className="flex items-center gap-6">
                                                            {q.metrics && (
                                                                <div className="flex-1 min-w-0">
                                                                    <ProgressTracker metrics={q.metrics} variant={"v2" as any} className="w-full bg-slate-50/20" />
                                                                </div>
                                                            )}
                                                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-slate-100 rounded-full">
                                                                            <MoreHorizontal className="h-5 w-5 text-slate-400" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem asChild>
                                                                            <Link href={`/app/le/${le.id}/workbench4?rel=${encodeURIComponent(engagement.org.name)}&q=${encodeURIComponent(q.name)}`}>
                                                                                <Sparkles className="h-4 w-4 mr-2" />
                                                                                Open in Workbench
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild>
                                                                            <Link href={`/app/le/${le.id}/engagement-new/${engagement.id}/questionnaire/${q.id}`}>
                                                                                <Settings className="h-4 w-4 mr-2" />
                                                                                Manage Questions
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => setShareTarget({ id: q.id, name: q.name })}>
                                                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2"><path d="M5 2.5C5 2.22386 5.22386 2 5.5 2H12.5C12.7761 2 13 2.22386 13 2.5V9.5C13 9.77614 12.7761 10 12.5 10H8.5V11.5C8.5 11.6663 8.41804 11.8217 8.27639 11.9056C8.13475 11.9894 7.95473 11.9894 7.81309 11.9056L3.81309 9.53056C3.60155 9.40498 3.5 9.14159 3.5 8.875V3.5C3.5 3.22386 3.72386 3 4 3H8.5V2H5.5C4.67157 2 4 2.67157 4 3.5V8.5H1.5C1.22386 8.5 1 8.72386 1 9V11.5C1 12.3284 1.67157 13 2.5 13H5V14.5C5 14.6663 5.08196 14.8217 5.22361 14.9056C5.36525 14.9894 5.54527 14.9894 5.68691 14.9056L9.68691 12.5306C9.89845 12.405 10 12.1416 10 11.875V11H12.5C13.3284 11 14 10.3284 14 9.5V2.5C14 1.67157 13.3284 1 12.5 1H5.5C4.67157 1 4 1.67157 4 2.5V3H5V2.5ZM2.5 12C2.22386 12 2 11.7761 2 11.5V9.5H4V11.082L7.5 13.1601V12H5.5C4.67157 12 4 11.3284 4 10.5V9H2.5C2.22386 9 2 9.22386 2 9.5V12C2 12.2761 2.22386 12.5 2.5 12Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                                                            Share to other Engagements
                                                                        </DropdownMenuItem>
                                                                         <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteQuestionnaire(q.id, q.name)}>
                                                                             <Trash2 className="h-4 w-4 mr-2" />
                                                                             Remove
                                                                         </DropdownMenuItem>
                                                                     </DropdownMenuContent>
                                                                 </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    </Link>
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

                    <TabsContent value="output" className="mt-0">
                        <OutputPackBuilder />
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

                    <TabsContent value="source" className="mt-0">
                        <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl m-8">
                            <Sparkles className="h-10 w-10 text-indigo-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-800">Source & Processing</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2">
                                Review the original source document and view the processing logs for this questionnaire mapping.
                            </p>
                            <Button variant="outline" className="mt-6 gap-2">
                                <FileText className="h-4 w-4" />
                                View Source Document
                            </Button>
                        </div>
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

            <ShareQuestionnaireDialog
                open={shareTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setShareTarget(null);
                }}
                clientLEId={le.id}
                currentEngagementId={engagement.id}
                questionnaireId={shareTarget?.id || ""}
                questionnaireName={shareTarget?.name || ""}
            />


        </div>
    );
}
