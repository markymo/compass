"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

export type MetricLinkContext = {
    leId: string;
    relationshipId?: string;
    questionnaireId?: string;
};

export interface ExperimentalMetricSummaryProps {
    metrics?: QuestionStateMetrics;
    linkContext?: MetricLinkContext;
    className?: string;
}

export function ExperimentalMetricSummary({
    metrics = { questionnairesCount: 0, total: 0, external: 0, userInput: 0, defaultResponse: 0, unanswered: 0 },
    linkContext,
    className,
}: ExperimentalMetricSummaryProps) {
    const { questionnairesCount = 0, total, external, userInput, defaultResponse, unanswered } = metrics;

    const buildHref = (answerState?: "external" | "user_input" | "default_response" | "unanswered") => {
        if (!linkContext || !linkContext.leId) return "#";
        const params = new URLSearchParams();

        if (linkContext.relationshipId) {
            params.set("relationshipId", linkContext.relationshipId);
        } else if (linkContext.questionnaireId) {
            params.set("questionnaireId", linkContext.questionnaireId);
        }

        if (answerState) {
            params.set("answerState", answerState);
        }

        const queryString = params.toString();
        return `/app/le/${linkContext.leId}/workbench4${queryString ? `?${queryString}` : ""}`;
    };

    const isZeroPopulation = total === 0 && questionnairesCount === 0;

    const renderCell = (
        val: number,
        answerState: "external" | "user_input" | "default_response" | "unanswered" | undefined,
        isTotal: boolean,
        mutedStyle: boolean = false,
        isStructuralCount: boolean = false
    ) => {
        if (isZeroPopulation) {
            return <span className="text-sm text-slate-300 dark:text-zinc-700">-</span>;
        }

        const textClass = isStructuralCount
            ? "text-sm font-medium font-mono text-slate-600 dark:text-zinc-400"
            : isTotal
            ? "text-sm font-bold font-mono text-slate-900 dark:text-slate-100"
            : mutedStyle
            ? "text-sm font-medium font-mono text-slate-300 dark:text-zinc-700"
            : "text-sm font-medium font-mono text-slate-700 dark:text-zinc-300";

        if (linkContext && linkContext.leId && !isStructuralCount) {
            const href = buildHref(answerState);
            return (
                <Link
                    href={href}
                    className={cn(
                        textClass,
                        "hover:underline focus:outline-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    )}
                    data-testid={`metric-link-${answerState || "total"}`}
                >
                    {val}
                </Link>
            );
        }

        return <span className={textClass}>{val}</span>;
    };

    return (
        <div
            data-testid="experimental-metric-summary"
            className={cn(
                "grid grid-cols-[65px_70px_85px_70px_70px_70px] gap-2 items-center text-right shrink-0",
                className
            )}
        >
            {/* 1. Structural Questionnaires Count */}
            <div>{renderCell(questionnairesCount, undefined, false, false, true)}</div>

            {/* 2. Total Questions (Anchor metric: bold, separated by border/gap) */}
            <div className="pr-3 border-r border-slate-200/80 dark:border-zinc-700/80">
                {renderCell(total, undefined, true)}
            </div>

            {/* 3. External Answers */}
            <div>{renderCell(external, "external", false)}</div>

            {/* 4. User Input */}
            <div>{renderCell(userInput, "user_input", false)}</div>

            {/* 5. Default Answers */}
            <div>{renderCell(defaultResponse, "default_response", false, defaultResponse === 0)}</div>

            {/* 6. Unanswered */}
            <div>{renderCell(unanswered, "unanswered", false, unanswered === 0)}</div>
        </div>
    );
}
