"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileText, Calendar, User, Building2, ShieldCheck, Loader2 } from "lucide-react";
import { getSubmissionDetailAction } from "@/actions/submission-actions";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { format } from "date-fns";

interface HistoricalSubmissionDialogProps {
    submissionId: string | null;
    onClose: () => void;
}

export function HistoricalSubmissionDialog({ submissionId, onClose }: HistoricalSubmissionDialogProps) {
    const [loading, setLoading] = useState(false);
    const [submission, setSubmission] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!submissionId) {
            setSubmission(null);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        getSubmissionDetailAction(submissionId).then(res => {
            if (!isMounted) return;
            setLoading(false);
            if (res.success && res.data) {
                setSubmission(res.data);
            } else {
                setError(res.error || "Failed to load submission details.");
            }
        });

        return () => { isMounted = false; };
    }, [submissionId]);

    const handleExportPdf = () => {
        if (!submission) return;
        const qId = submission.questionnaireId;
        const subId = submission.id;
        window.open(`/api/export/questionnaire/${qId}?submissionId=${subId}`, '_blank');
    };

    return (
        <Dialog open={Boolean(submissionId)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-4 pr-6">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-indigo-600" />
                                {submission?.questionnaire?.name || "Historical Submission"}
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Definition Version {submission?.definitionVersion?.versionNumber}</span>
                                <span>•</span>
                                <span>Submission #{submission?.submissionNumber}</span>
                                {submission?.relationship?.org?.name && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 font-medium text-slate-700">
                                            <Building2 className="h-3 w-3" />
                                            {submission.relationship.org.name}
                                        </span>
                                    </>
                                )}
                            </DialogDescription>
                        </div>
                        {submission && (
                            <Button size="sm" variant="outline" onClick={handleExportPdf} className="flex items-center gap-1.5">
                                <Download className="h-4 w-4" />
                                Export PDF
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {loading && (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-600" />
                        <p className="text-sm">Loading frozen submission snapshot...</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}

                {submission && !loading && (
                    <div className="space-y-6 pt-2">
                        {/* Submitter Metadata Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs border border-slate-200">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <div>
                                    <div className="text-muted-foreground">Submitted At</div>
                                    <div className="font-semibold text-slate-800">
                                        {format(new Date(submission.submittedAt), "PPP 'at' p")}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <div>
                                    <div className="text-muted-foreground">Submitted By</div>
                                    <div className="font-semibold text-slate-800">
                                        {submission.submittedBy?.name || submission.submittedBy?.email || "Unknown"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                                <div>
                                    <div className="text-muted-foreground">Snapshot Guarantee</div>
                                    <div className="font-semibold text-indigo-900">
                                        Immutable Historical Record
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Frozen Answers Feed */}
                        <div className="space-y-4">
                            {submission.answers?.map((ans: any, idx: number) => {
                                const qSnap = ans.questionSnapshot;
                                const displayModel = ans.explicitNone
                                    ? resolveFieldForDisplay(
                                          { explicitNone: true },
                                          ans.provenanceJson ? { type: ans.provenanceJson.sourceType || "USER_INPUT" } : null,
                                          { fieldNo: snapMasterField(snapMasterFieldNo(ans, qSnap)), label: snapText(ans, qSnap) }
                                      )
                                    : resolveFieldForDisplay(
                                          ans.valueJson,
                                          ans.provenanceJson ? { type: ans.provenanceJson.sourceType || "USER_INPUT", timestamp: ans.provenanceJson.assertedAt } : null,
                                          { fieldNo: snapMasterField(snapMasterFieldNo(ans, qSnap)), label: snapText(ans, qSnap) }
                                      );

                                return (
                                    <Card key={ans.id} className="border-slate-200 shadow-sm">
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="font-semibold text-sm text-slate-900 flex items-start gap-2">
                                                    <span className="text-xs text-muted-foreground font-mono mt-0.5">
                                                        Q{idx + 1}.
                                                    </span>
                                                    {snapText(ans, qSnap)}
                                                </div>
                                                {ans.provenanceJson?.sourceType && (
                                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-mono">
                                                        {ans.provenanceJson.sourceLabel || ans.provenanceJson.sourceType}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="bg-slate-50/70 p-3 rounded-md border border-slate-100">
                                                <FieldValueRenderer field={displayModel} />
                                            </div>

                                            {ans.attachments && ans.attachments.length > 0 && (
                                                <div className="pt-1 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                                                    <span className="font-medium text-slate-700">Attachments:</span>
                                                    {ans.attachments.map((att: any) => (
                                                        <Badge key={att.documentId} variant="secondary" className="text-xs">
                                                            {att.document?.name || "Document"}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function snapMasterFieldNo(ans: any, qSnap: any): number {
    return ans.masterFieldNo ?? qSnap?.masterFieldNo ?? 0;
}

function snapMasterField(val: any): number {
    return typeof val === 'number' ? val : 0;
}

function snapText(ans: any, qSnap: any): string {
    return ans.questionTextSnapshot || qSnap?.questionText || "Question";
}
