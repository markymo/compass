"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Calendar, User, Building2, Layers, Clock, Loader2 } from "lucide-react";
import { getSubmissionHistoryAction } from "@/actions/submission-actions";
import { HistoricalSubmissionDialog } from "./historical-submission-dialog";
import { format } from "date-fns";

interface QuestionnaireSubmissionHistoryProps {
    questionnaireId: string;
    relationshipId?: string;
    showRelationshipName?: boolean;
}

export function QuestionnaireSubmissionHistory({
    questionnaireId,
    relationshipId,
    showRelationshipName = false
}: QuestionnaireSubmissionHistoryProps) {
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

    const loadHistory = async () => {
        setLoading(true);
        const res = await getSubmissionHistoryAction({ questionnaireId, relationshipId });
        setLoading(false);
        if (res.success && res.data) {
            setSubmissions(res.data);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [questionnaireId, relationshipId]);

    // Group submissions by definition version number
    const grouped = submissions.reduce((acc: Record<number, any[]>, sub: any) => {
        const ver = sub.definitionVersion?.versionNumber || 1;
        if (!acc[ver]) acc[ver] = [];
        acc[ver].push(sub);
        return acc;
    }, {});

    const sortedVersionNumbers = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => b - a);

    return (
        <div className="space-y-6">
            <HistoricalSubmissionDialog
                submissionId={selectedSubmissionId}
                onClose={() => setSelectedSubmissionId(null)}
            />

            {loading && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-600" />
                    <span className="text-xs">Loading submission history...</span>
                </div>
            )}

            {!loading && submissions.length === 0 && (
                <Card className="border-dashed border-slate-200">
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                        <h4 className="font-semibold text-slate-700 text-sm">No Approvals Yet</h4>
                        <p className="text-xs max-w-sm mx-auto mt-1 text-slate-500">
                            When you approve this questionnaire for a relationship, an immutable historical approval snapshot will appear here.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!loading && sortedVersionNumbers.map(verNo => {
                const subsInVer = grouped[verNo];
                const defVersion = subsInVer[0]?.definitionVersion;

                return (
                    <Card key={verNo} className="border-slate-200">
                        <CardHeader className="py-3 px-4 bg-slate-50/70 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-indigo-600" />
                                    <CardTitle className="text-sm font-semibold text-slate-800">
                                        Questionnaire Definition Version {verNo}
                                    </CardTitle>
                                    {defVersion?.questionCount !== undefined && (
                                        <Badge variant="outline" className="text-[10px] font-normal">
                                            {defVersion.questionCount} questions
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    Frozen {defVersion?.createdAt ? format(new Date(defVersion.createdAt), "MMM d, yyyy") : ""}
                                </span>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0 divide-y divide-slate-100">
                            {subsInVer.map((sub: any) => (
                                <div key={sub.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-slate-900">
                                                Approval #{sub.submissionNumber}
                                            </span>
                                            {showRelationshipName && sub.relationship?.org?.name && (
                                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                                    <Building2 className="h-3 w-3" />
                                                    {sub.relationship.org.name}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {format(new Date(sub.submittedAt), "MMM d, yyyy 'at' HH:mm")}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-3.5 w-3.5 text-slate-400" />
                                                {sub.submittedBy?.name || sub.submittedBy?.email || "User"}
                                            </span>
                                            <span>
                                                {sub.answers?.length || 0} answers snapshotted
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
                                            <Eye className="h-3.5 w-3.5" />
                                            View Snapshot
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => window.open(`/api/export/questionnaire/${questionnaireId}?submissionId=${sub.id}`, '_blank')}
                                            className="h-8 text-xs flex items-center gap-1.5"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            Export PDF
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
