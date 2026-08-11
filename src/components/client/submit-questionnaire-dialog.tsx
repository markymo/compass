"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Building2, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { getRelationshipsForLEAction, submitQuestionnaireAction } from "@/actions/submission-actions";

interface SubmitQuestionnaireDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questionnaireId: string;
    clientLEId: string;
    questionnaireName: string;
    onSuccess?: () => void;
}

export function SubmitQuestionnaireDialog({
    open,
    onOpenChange,
    questionnaireId,
    clientLEId,
    questionnaireName,
    onSuccess
}: SubmitQuestionnaireDialogProps) {
    const [loadingRel, setLoadingRel] = useState(false);
    const [relationships, setRelationships] = useState<Array<{ id: string; orgName: string; status: string }>>([]);
    const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittedResult, setSubmittedResult] = useState<{ versionNumber?: number; submissionNumber?: number } | null>(null);

    useEffect(() => {
        if (!open) {
            setSubmittedResult(null);
            setError(null);
            return;
        }

        let isMounted = true;
        setLoadingRel(true);
        getRelationshipsForLEAction(clientLEId).then(res => {
            if (!isMounted) return;
            setLoadingRel(false);
            if (res.success && res.data) {
                setRelationships(res.data);
                if (res.data.length > 0) {
                    setSelectedRelationshipId(res.data[0].id);
                }
            }
        });

        return () => { isMounted = false; };
    }, [open, clientLEId]);

    const handleSubmit = async () => {
        if (!selectedRelationshipId) {
            setError("Please select a relationship to submit to.");
            return;
        }

        setSubmitting(true);
        setError(null);

        const res = await submitQuestionnaireAction({
            questionnaireId,
            relationshipId: selectedRelationshipId,
            clientLEId
        });

        setSubmitting(false);

        if (res.success) {
            setSubmittedResult({
                versionNumber: res.versionNumber,
                submissionNumber: res.submissionNumber
            });
            if (onSuccess) onSuccess();
        } else {
            setError(res.error || "Failed to submit questionnaire.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Send className="h-5 w-5 text-indigo-600" />
                        Submit Questionnaire
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                        Creates an immutable, versioned historical submission snapshot for your selected financial institution relationship.
                    </DialogDescription>
                </DialogHeader>

                {submittedResult ? (
                    <div className="py-6 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-base">Submission Successful!</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                Snapshot frozen under Definition Version <span className="font-semibold text-slate-800">{submittedResult.versionNumber}</span> as Submission <span className="font-semibold text-slate-800">#{submittedResult.submissionNumber}</span>.
                            </p>
                        </div>
                        <DialogFooter className="pt-4 justify-center">
                            <Button size="sm" onClick={() => onOpenChange(false)}>
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Target Relationship / Financial Institution</label>
                            {loadingRel ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading relationships...
                                </div>
                            ) : relationships.length === 0 ? (
                                <div className="p-3 bg-amber-50 text-amber-800 rounded-md text-xs">
                                    No active relationships found for this legal entity. Please create a relationship before submitting.
                                </div>
                            ) : (
                                <Select value={selectedRelationshipId} onValueChange={setSelectedRelationshipId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Relationship" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {relationships.map(r => (
                                            <SelectItem key={r.id} value={r.id}>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{r.orgName}</span>
                                                    <Badge variant="outline" className="text-[10px] py-0 ml-1">
                                                        {r.status}
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-md text-xs text-indigo-900 space-y-1">
                            <div className="font-semibold flex items-center gap-1.5 text-indigo-950">
                                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                Submission Guarantee
                            </div>
                            <p className="text-[11px] text-indigo-800 leading-normal">
                                Submitting freezes current canonical answers & reference details into an immutable snapshot. Subsequent master data updates will not alter this submitted record.
                            </p>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={submitting || relationships.length === 0}
                                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Submit Now
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
