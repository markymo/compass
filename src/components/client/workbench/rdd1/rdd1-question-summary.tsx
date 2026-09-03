"use client";

import React from "react";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { Lock, FileText, Paperclip, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Rdd1QuestionSummaryProps {
    question: ConsoleQuestion;
    index?: number;
    isMapped: boolean;
}

export function Rdd1QuestionSummary({ question, index, isMapped }: Rdd1QuestionSummaryProps) {
    const questionRef = question.text.match(/^Q\d+[:.]?/i)
        ? ""
        : typeof index === "number"
        ? `Q${index + 1}: `
        : "";

    const attachmentCount = question.canonicalDisplayModel?.attachments?.length || 0;

    return (
        <div className="flex flex-col justify-between h-full space-y-3">
            <div className="space-y-2">
                <h3 className="text-sm font-bold text-foreground leading-snug tracking-tight break-words uppercase">
                    {questionRef}{question.text}
                </h3>

                {!isMapped && (
                    <div className="pt-1">
                        <Badge
                            variant="secondary"
                            className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 gap-1 text-[11px] font-semibold"
                        >
                            <AlertCircle className="h-3 w-3" />
                            Mapping required
                        </Badge>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted font-semibold text-[10px] tracking-wide uppercase text-foreground">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    {question.engagementOrgName || "COMMON"}
                </span>

                <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground truncate max-w-[200px]"
                    title={question.questionnaireName}
                >
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{question.questionnaireName}</span>
                </span>

                {attachmentCount > 0 && (
                    <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold"
                        title={`${attachmentCount} canonical document(s)`}
                    >
                        <Paperclip className="h-3 w-3" />
                        {attachmentCount} {attachmentCount === 1 ? "doc" : "docs"}
                    </span>
                )}
            </div>
        </div>
    );
}
