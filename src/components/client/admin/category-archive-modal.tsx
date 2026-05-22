"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ArchiveX, AlertTriangle, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getCategoryImpactSummary, retireMasterDataCategory } from "@/actions/master-data-governance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CategoryArchiveModalProps {
    category: { id: string; displayName: string; fields: any[] } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRetired: (categoryId: string) => void;
}

type ImpactSummary = {
    fieldCount: number;
    activeSourceMappings: number;
    totalSourceMappings: number;
    fieldClaimCount: number;
    questionCount: number;
    isEmptyCategory: boolean;
    hasLiveReferences: boolean;
};

export function CategoryArchiveModal({
    category,
    open,
    onOpenChange,
    onRetired,
}: CategoryArchiveModalProps) {
    const [summary, setSummary] = useState<ImpactSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [reason, setReason] = useState("");
    const [confirming, setConfirming] = useState(false);

    // Fetch impact summary whenever the modal opens
    useEffect(() => {
        if (!open || !category) {
            setSummary(null);
            setReason("");
            return;
        }
        setLoadingSummary(true);
        getCategoryImpactSummary(category.id).then(res => {
            setLoadingSummary(false);
            if (res.success && res.summary) {
                setSummary(res.summary);
            } else {
                toast.error(res.error ?? "Failed to load impact summary");
                onOpenChange(false);
            }
        });
    }, [open, category?.id]);

    const handleConfirm = async () => {
        if (!category || !summary) return;
        if (!reason.trim()) {
            toast.error("Please enter a reason before archiving");
            return;
        }
        setConfirming(true);

        // Hard delete only when genuinely empty
        const forceHardDelete = summary.isEmptyCategory;
        const res = await retireMasterDataCategory(category.id, reason.trim(), { forceHardDelete });
        setConfirming(false);

        if (res.success) {
            if (res.hardDeleted) {
                toast.success(`"${category.displayName}" permanently deleted (was empty)`);
            } else {
                toast.success(`"${category.displayName}" archived — ${summary.fieldCount} field${summary.fieldCount !== 1 ? "s" : ""} retired`);
            }
            onOpenChange(false);
            onRetired(category.id);
        } else {
            toast.error(res.error ?? "Failed to archive category");
        }
    };

    if (!category) return null;

    const isReady = !loadingSummary && summary !== null;
    const canSubmit = isReady && reason.trim().length > 0 && !confirming;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                        <ArchiveX className="w-5 h-5" />
                        Archive Category
                    </DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold text-slate-800">{category.displayName}</span>
                        <span className="text-slate-500"> — review the impact before proceeding</span>
                    </DialogDescription>
                </DialogHeader>

                {/* Impact summary */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    {loadingSummary ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" /> Analysing dependencies…
                        </div>
                    ) : summary ? (
                        <>
                            <p className="text-sm font-medium text-slate-700">Impact summary</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                <ImpactRow label="Fields to retire" value={summary.fieldCount} highlight={summary.fieldCount > 0} />
                                <ImpactRow label="Source mappings to deactivate" value={summary.activeSourceMappings} highlight={summary.activeSourceMappings > 0} />
                                <ImpactRow label="FieldClaims (historical, preserved)" value={summary.fieldClaimCount} warning={summary.fieldClaimCount > 0} />
                                <ImpactRow label="Questionnaire questions (preserved)" value={summary.questionCount} warning={summary.questionCount > 0} />
                            </div>

                            {summary.hasLiveReferences && (
                                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 mt-1">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        This category has live references. It will be <strong>retired, not deleted</strong>.
                                        All historical FieldClaims, questionnaire answers, and schema snapshots remain intact
                                        and will continue to resolve correctly.
                                    </p>
                                </div>
                            )}

                            {summary.isEmptyCategory && (
                                <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 mt-1">
                                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        This category has no fields and no references. It will be <strong>permanently deleted</strong>.
                                    </p>
                                </div>
                            )}

                            <p className="text-xs text-slate-400 pt-1">
                                {summary.isEmptyCategory
                                    ? "Nothing will be affected. Safe to delete."
                                    : "Archived categories are hidden from all active workflows. This action can be reversed by a platform admin via direct DB update."}
                            </p>
                        </>
                    ) : null}
                </div>

                {/* Reason field */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                        Reason for archiving <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="E.g. Replaced by EntityInfoProfile, no longer needed as a separate category…"
                        maxLength={500}
                        className="resize-none text-sm"
                        rows={3}
                        disabled={confirming}
                    />
                    <p className="text-xs text-slate-400 text-right">{reason.length}/500</p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-1">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
                        Cancel
                    </Button>
                    <Button
                        disabled={!canSubmit}
                        onClick={handleConfirm}
                        className={cn(
                            "gap-2",
                            summary?.isEmptyCategory
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                    >
                        {confirming
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Archiving…</>
                            : summary?.isEmptyCategory
                            ? <><ArchiveX className="w-4 h-4" /> Delete Category</>
                            : <><ArchiveX className="w-4 h-4" /> Archive Category</>
                        }
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ImpactRow({ label, value, highlight, warning }: { label: string; value: number; highlight?: boolean; warning?: boolean }) {
    return (
        <>
            <span className="text-slate-600">{label}</span>
            <span className={cn(
                "font-semibold",
                highlight && value > 0 ? "text-amber-700" : warning && value > 0 ? "text-orange-600" : "text-slate-500"
            )}>
                {value}
                {warning && value > 0 && (
                    <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 text-orange-600 border-orange-300">preserved</Badge>
                )}
            </span>
        </>
    );
}
