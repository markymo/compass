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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Building2, FileText, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import {
    getRelationshipsForLEAction,
    getQuestionnairesForRelationshipAction,
    submitMultipleQuestionnairesAction
} from "@/actions/submission-actions";

interface CreateApprovalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientLEId: string;
    initialRelationships?: Array<{ id: string; orgName?: string; org?: { name: string }; status: string }>;
    initialRelationshipId?: string;
    initialQuestionnaireId?: string;
    onSuccess?: () => void;
}

export function CreateApprovalDialog({
    open,
    onOpenChange,
    clientLEId,
    initialRelationships,
    initialRelationshipId,
    initialQuestionnaireId,
    onSuccess
}: CreateApprovalDialogProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Step 1 State: Relationship Selection
    const [loadingRelationships, setLoadingRelationships] = useState(false);
    const [relationships, setRelationships] = useState<Array<{ id: string; orgName: string; status: string }>>([]);
    const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>("");

    // Step 2 State: Questionnaire Selection
    const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
    const [availableQuestionnaires, setAvailableQuestionnaires] = useState<Array<{ id: string; name: string; referenceCode?: string | null; isCommon: boolean; questionCount: number }>>([]);
    const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState<Set<string>>(new Set());

    // Step 3 State: Confirmation & Submitting
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [approvedSuccess, setApprovedSuccess] = useState(false);

    // Reset / Initialize on open
    useEffect(() => {
        if (!open) {
            setStep(1);
            setError(null);
            setApprovedSuccess(false);
            return;
        }

        let isMounted = true;

        if (initialRelationships && initialRelationships.length > 0) {
            const mapped = initialRelationships.map((r: any) => ({
                id: r.id,
                orgName: r.orgName || r.org?.name || "Unknown Supplier",
                status: r.status
            }));
            setRelationships(mapped);
            setLoadingRelationships(false);

            const targetRel = (initialRelationshipId && mapped.some((r: any) => r.id === initialRelationshipId))
                ? initialRelationshipId
                : (mapped[0]?.id || "");

            setSelectedRelationshipId(targetRel);
            return;
        }

        setLoadingRelationships(true);

        getRelationshipsForLEAction(clientLEId).then(res => {
            if (!isMounted) return;
            setLoadingRelationships(false);
            if (res.success && res.data) {
                setRelationships(res.data);
                
                // Preselect initial relationship if passed, otherwise default to first relationship
                const targetRel = (initialRelationshipId && res.data.some((r: any) => r.id === initialRelationshipId))
                    ? initialRelationshipId
                    : (res.data[0]?.id || "");
                
                setSelectedRelationshipId(targetRel);
            } else if (!res.success) {
                setError(res.error || "Failed to load relationships for this legal entity.");
            }
        });

        return () => { isMounted = false; };
    }, [open, clientLEId, initialRelationshipId, initialRelationships]);

    // Fetch questionnaires whenever selectedRelationshipId changes
    useEffect(() => {
        if (!selectedRelationshipId || !open) return;

        let isMounted = true;
        setLoadingQuestionnaires(true);
        setSelectedQuestionnaireIds(new Set());

        getQuestionnairesForRelationshipAction({
            relationshipId: selectedRelationshipId,
            clientLEId
        }).then(res => {
            if (!isMounted) return;
            setLoadingQuestionnaires(false);
            if (res.success && res.data) {
                setAvailableQuestionnaires(res.data);
                
                // Preselect initial questionnaire if provided, or default to all checked
                if (initialQuestionnaireId && res.data.some((q: any) => q.id === initialQuestionnaireId)) {
                    setSelectedQuestionnaireIds(new Set([initialQuestionnaireId]));
                } else if (res.data.length > 0) {
                    setSelectedQuestionnaireIds(new Set(res.data.map((q: any) => q.id)));
                }

                // If pre-selecting via explicit parameters, leap straight to step 2 or 3 if relationship is preselected
                if (initialRelationshipId && initialQuestionnaireId) {
                    setStep(2);
                }
            }
        });

        return () => { isMounted = false; };
    }, [selectedRelationshipId, open, clientLEId, initialQuestionnaireId, initialRelationshipId]);

    const handleToggleQuestionnaire = (qId: string) => {
        const next = new Set(selectedQuestionnaireIds);
        if (next.has(qId)) {
            next.delete(qId);
        } else {
            next.add(qId);
        }
        setSelectedQuestionnaireIds(next);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedQuestionnaireIds(new Set(availableQuestionnaires.map(q => q.id)));
        } else {
            setSelectedQuestionnaireIds(new Set());
        }
    };

    const selectedRelationship = relationships.find(r => r.id === selectedRelationshipId);
    const selectedQuestionnairesList = availableQuestionnaires.filter(q => selectedQuestionnaireIds.has(q.id));

    const handleFinalApprove = async () => {
        if (!selectedRelationshipId || selectedQuestionnaireIds.size === 0) return;

        setSubmitting(true);
        setError(null);

        const res = await submitMultipleQuestionnairesAction({
            questionnaireIds: Array.from(selectedQuestionnaireIds),
            relationshipId: selectedRelationshipId,
            clientLEId
        });

        setSubmitting(false);

        if (res.success) {
            setApprovedSuccess(true);
            if (onSuccess) onSuccess();
        } else {
            setError(res.error || "Failed to create formal approval.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Create approval
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Create a formal, immutable approval snapshot of questionnaire responses for a supplier relationship.
                    </DialogDescription>
                </DialogHeader>

                {approvedSuccess ? (
                    <div className="py-6 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-base">Approval Created Successfully</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                Formally approved <span className="font-semibold text-slate-800">{selectedQuestionnaireIds.size} questionnaire(s)</span> for <span className="font-semibold text-slate-800">{selectedRelationship?.orgName}</span>.
                            </p>
                        </div>
                        <DialogFooter className="pt-2 justify-center">
                            <Button size="sm" onClick={() => onOpenChange(false)} className="bg-slate-900 text-white">
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4 pt-1">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs">
                                {error}
                            </div>
                        )}

                        {/* Step 1: Select Relationship */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700 block">
                                        Relationship
                                    </label>
                                    {loadingRelationships ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading relationships...
                                        </div>
                                    ) : relationships.length === 0 ? (
                                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs">
                                            No active supplier relationships found for this legal entity.
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
                                                            <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 ml-1">
                                                                {r.status === 'PREPARATION' ? 'DRAFT' : r.status}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                <DialogFooter className="pt-3">
                                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={!selectedRelationshipId || loadingRelationships}
                                        onClick={() => setStep(2)}
                                        className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        Next
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}

                        {/* Step 2: Select Questionnaires */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                                        <Building2 className="h-4 w-4 text-slate-400" />
                                        <span>Target: <strong className="text-slate-900">{selectedRelationship?.orgName}</strong></span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-6 text-[11px] text-indigo-600 px-1.5 hover:bg-indigo-50">
                                        Change
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Questionnaires to approve
                                        </label>
                                        {availableQuestionnaires.length > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <Checkbox
                                                    id="select-all"
                                                    checked={selectedQuestionnaireIds.size === availableQuestionnaires.length && availableQuestionnaires.length > 0}
                                                    onCheckedChange={(val) => handleSelectAll(Boolean(val))}
                                                />
                                                <label htmlFor="select-all" className="text-[11px] text-slate-500 cursor-pointer">Select All</label>
                                            </div>
                                        )}
                                    </div>

                                    {loadingQuestionnaires ? (
                                        <div className="py-6 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                            <span>Loading questionnaires...</span>
                                        </div>
                                    ) : availableQuestionnaires.length === 0 ? (
                                        <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-md text-xs text-center">
                                            No questionnaires found for this relationship.
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                                            {availableQuestionnaires.map(q => {
                                                const checked = selectedQuestionnaireIds.has(q.id);
                                                return (
                                                    <div
                                                        key={q.id}
                                                        onClick={() => handleToggleQuestionnaire(q.id)}
                                                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={() => handleToggleQuestionnaire(q.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-semibold text-slate-800 truncate">{q.name}</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {q.questionCount} questions {q.referenceCode ? `• ${q.referenceCode}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {q.isCommon && (
                                                            <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 shrink-0 bg-purple-50 text-purple-700 border-purple-200">
                                                                Common
                                                            </Badge>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="pt-2 justify-between">
                                    <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1">
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={selectedQuestionnaireIds.size === 0 || loadingQuestionnaires}
                                        onClick={() => setStep(3)}
                                        className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        Review ({selectedQuestionnaireIds.size})
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}

                        {/* Step 3: Confirm Summary */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                                    <div className="text-slate-500">Approve for:</div>
                                    <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-indigo-600" />
                                        {selectedRelationship?.orgName}
                                    </div>
                                    <div className="text-slate-500 pt-1">
                                        {selectedQuestionnaireIds.size} questionnaire(s) selected:
                                    </div>
                                    <ul className="space-y-1 pl-2 border-l-2 border-slate-300 font-medium text-slate-800">
                                        {selectedQuestionnairesList.map(q => (
                                            <li key={q.id} className="flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{q.name}</span>
                                                {q.isCommon && (
                                                    <span className="text-[10px] text-purple-700 font-normal">(Common)</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-md text-[11px] text-indigo-900">
                                    <p className="font-semibold text-indigo-950 flex items-center gap-1.5 mb-0.5">
                                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Formal Approval Guarantee
                                    </p>
                                    <p className="text-indigo-800 leading-normal">
                                        Creating an approval freezes current responses into an immutable, versioned historical snapshot that the Client formally stands behind.
                                    </p>
                                </div>

                                <DialogFooter className="pt-2 justify-between">
                                    <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                                        Back
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleFinalApprove}
                                            disabled={submitting}
                                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                                        >
                                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                            Approve Now
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
