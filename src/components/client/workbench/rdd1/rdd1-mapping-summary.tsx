"use client";

import React from "react";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { ChevronRight, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Rdd1MappingSummaryProps {
    question: ConsoleQuestion;
    masterFields: Array<{ fieldNo: number; label: string }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
    isMapped: boolean;
    onInspectMapping: () => void;
    disabled?: boolean;
}

export function Rdd1MappingSummary({
    question,
    masterFields,
    masterGroups,
    customFields,
    isMapped,
    onInspectMapping,
    disabled = false
}: Rdd1MappingSummaryProps) {
    let mappingTitle = "Unmapped";
    let mappingType = "MAPPING REQUIRED";

    if (question.masterQuestionGroupId) {
        const grp = masterGroups.find((g) => g.key === question.masterQuestionGroupId);
        mappingTitle = grp?.label || question.masterQuestionGroupId;
        mappingType = "COMPOSITE GROUP";
    } else if (question.masterFieldNo) {
        const field = masterFields.find((f) => f.fieldNo === question.masterFieldNo);
        mappingTitle = field?.label || `Field ${question.masterFieldNo}`;
        mappingType = `MASTER FIELD #${question.masterFieldNo}`;

        if (question.masterFieldProjectionPath) {
            mappingType += ` (${question.masterFieldProjectionPath})`;
        }
    } else if ((question as any).customFieldDefinitionId) {
        const cf = customFields.find((f) => f.id === (question as any).customFieldDefinitionId);
        mappingTitle = cf?.label || "Custom Field";
        mappingType = "CUSTOM FIELD";
    }

    return (
        <div className="flex flex-col justify-between h-full space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Master Data Mapping
                </span>
                <span
                    className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded tracking-normal font-semibold",
                        question.status === "RELEASED"
                            ? "bg-muted text-muted-foreground"
                            : question.status === "SHARED"
                            ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                            : question.status === "APPROVED"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : question.status === "DRAFT"
                            ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {isMapped ? question.status : "UNMAPPED"}
                </span>
            </div>

            <button
                type="button"
                data-testid={`rdd1-mapping-tile-${question.id}`}
                onClick={onInspectMapping}
                className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between gap-3 group",
                    isMapped
                        ? "bg-muted/30 hover:bg-muted/60 border-border hover:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
                        : "bg-amber-50/50 dark:bg-amber-950/20 border-dashed border-amber-300 dark:border-amber-800 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                )}
                title="Inspect field details or choose alternative mapping"
            >
                <div className="flex-1 min-w-0 pr-1">
                    <h4
                        className={cn(
                            "text-sm font-bold truncate leading-tight transition-colors",
                            isMapped ? "text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400" : "text-amber-700 dark:text-amber-300 italic font-semibold"
                        )}
                    >
                        {mappingTitle}
                    </h4>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mt-1">
                        {mappingType}
                    </span>
                </div>

                <div className="flex items-center shrink-0">
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </div>
            </button>
        </div>
    );
}
