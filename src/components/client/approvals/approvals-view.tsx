"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus, Eye, Download, Building2, Calendar, User, FileText, Loader2, Layers, Clock } from "lucide-react";
import { getApprovalHistoryForLEAction } from "@/actions/submission-actions";
import { HistoricalSubmissionDialog } from "@/components/client/historical-submission-dialog";
import { CreateApprovalDialog } from "./create-approval-dialog";
import { format } from "date-fns";

interface ApprovalsViewProps {
    leId: string;
    leName: string;
    initialRelationships?: any[];
}

export function ApprovalsView({ leId, leName, initialRelationships = [] }: ApprovalsViewProps) {
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    const loadHistory = async () => {
        setLoading(true);
        const res = await getApprovalHistoryForLEAction(leId);
        setLoading(false);
        if (res.success && res.data) {
            setSubmissions(res.data);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [leId]);

    // Group submissions by Relationship Org Name
    const groupedByRelationship = submissions.reduce((acc: Record<string, any[]>, sub: any) => {
        const relName = sub.relationship?.org?.name || "Other Relationship";
        if (!acc[relName]) acc[relName] = [];
        acc[relName].push(sub);
        return acc;
    }, {});

    const relationshipNames = Object.keys(groupedByRelationship);

    return (
        <div className="space-y-6">
            <HistoricalSubmissionDialog
                submissionId={selectedSubmissionId}
                onClose={() => setSelectedSubmissionId(null)}
            />

            <CreateApprovalDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                clientLEId={leId}
                initialRelationships={initialRelationships}
                onSuccess={loadHistory}
            />

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Approvals
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Formal questionnaire approvals for <span className="font-semibold text-slate-700">{leName}</span>.
                    </p>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreateDialog(true)}
                    className="h-8 text-xs px-3 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 w-fit gap-1.5 font-medium"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Create approval
                </Button>
            </div>

            {loading && (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-600" />
                    <span className="text-xs font-medium">Loading approval history...</span>
                </div>
            )}

            {!loading && submissions.length === 0 && (
                <Card variant="structural" className="border-dashed border-slate-200">
                    <CardContent className="py-16 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-800 text-sm">No Formal Approvals Yet</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                Formally approving a questionnaire freezes an immutable historical snapshot of your data for a specific financial institution relationship.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Button
                                size="sm"
                                onClick={() => setShowCreateDialog(true)}
                                className="bg-slate-900 text-white hover:bg-slate-800 gap-2 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Create your first approval
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && relationshipNames.map(relName => {
                const subsForRel = groupedByRelationship[relName];

                return (
                    <Card key={relName} variant="structural" className="border-slate-200 overflow-hidden">
                        <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-slate-500" />
                                    <CardTitle className="text-sm font-bold text-slate-900">
                                        {relName}
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[10px] font-medium bg-white text-slate-600">
                                        {subsForRel.length} approval record{subsForRel.length === 1 ? '' : 's'}
                                    </Badge>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const relId = subsForRel[0]?.relationshipId;
                                        if (relId) {
                                            setShowCreateDialog(true);
                                        }
                                    }}
                                    className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 px-2"
                                >
                                    + Approve Questionnaire
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0 divide-y divide-slate-100">
                            {subsForRel.map((sub: any) => (
                                <div key={sub.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-slate-900">
                                                Approval #{sub.submissionNumber}
                                            </span>
                                            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 border-slate-200 font-medium">
                                                <FileText className="h-3 w-3 mr-1 text-slate-400" />
                                                {sub.questionnaire?.name || "Questionnaire"}
                                            </Badge>
                                            {sub.definitionVersion?.versionNumber && (
                                                <Badge variant="outline" className="text-[10px] text-slate-500 font-normal">
                                                    Definition v{sub.definitionVersion.versionNumber}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {format(new Date(sub.submittedAt), "MMM d, yyyy 'at' HH:mm")}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-3.5 w-3.5 text-slate-400" />
                                                {sub.submittedBy?.name || sub.submittedBy?.email || "User"}
                                            </span>
                                            <span>
                                                {sub.definitionVersion?.questionCount || sub.answers?.length || 0} questions snapshotted
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setSelectedSubmissionId(sub.id)}
                                            className="h-8 text-xs flex items-center gap-1.5"
                                        >
                                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                                            View Snapshot
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => window.open(`/api/export/questionnaire/${sub.questionnaireId}?submissionId=${sub.id}`, '_blank')}
                                            className="h-8 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
                                        >
                                            <Download className="h-3.5 w-3.5 text-slate-400" />
                                            PDF
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
