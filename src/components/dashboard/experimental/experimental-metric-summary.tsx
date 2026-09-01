"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

export type MetricLinkContext = {
    leId?: string;
    relationshipId?: string;
    questionnaireId?: string;
    supplierOrgId?: string;
    supplierRelName?: string;
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
        if (!linkContext) return "#";

        // Supplier Org route
        if (linkContext.supplierOrgId) {
            const params = new URLSearchParams();
            if (linkContext.supplierRelName) {
                params.set("rel", linkContext.supplierRelName);
            }
            if (linkContext.questionnaireId) {
                params.set("q", linkContext.questionnaireId);
            }
            if (answerState) {
                params.set("status", answerState === "unanswered" ? "UNANSWERED" : "ANSWERED");
            }
            const queryString = params.toString();
            return `/app/s/${linkContext.supplierOrgId}/questions${queryString ? `?${queryString}` : ""}`;
        }

        // Client LE route
        if (!linkContext.leId) return "#";
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

    const hasLink = linkContext && (linkContext.leId || linkContext.supplierOrgId);

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

        if (hasLink && !isStructuralCount) {
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

    const renderTotalCell = () => {
        if (isZeroPopulation) {
            return <span className="text-sm text-slate-300 dark:text-zinc-700">-</span>;
        }

        const displayContent = (
            <span className="inline-flex items-baseline justify-end gap-0.5">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{total}</span>
                <span className="text-xs font-mono text-slate-400">/</span>
                <span className="text-xs font-medium font-mono text-slate-500 dark:text-zinc-400">{questionnairesCount}</span>
            </span>
        );

        if (hasLink) {
            const href = buildHref(undefined);
            return (
                <Link
                    href={href}
                    className="hover:underline focus:outline-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    data-testid="metric-link-total"
                >
                    {displayContent}
                </Link>
            );
        }

        return displayContent;
    };

    return (
        <div
            data-testid="experimental-metric-summary"
            className={cn(
                "grid grid-cols-[80px_80px_80px_75px_85px] gap-2 items-center text-right shrink-0",
                className
            )}
        >
            {/* 1. Combined Total Questions / Questionnaires Count (e.g. 54/3) */}
            <div className="pr-3 border-r border-slate-200/80 dark:border-zinc-700/80">
                {renderTotalCell()}
            </div>

            {/* 2. External Answers */}
            <div>{renderCell(external, "external", false)}</div>

            {/* 3. User Input */}
            <div>{renderCell(userInput, "user_input", false)}</div>

            {/* 4. Default Answers */}
            <div>{renderCell(defaultResponse, "default_response", false, defaultResponse === 0)}</div>

            {/* 5. Unanswered */}
            <div>{renderCell(unanswered, "unanswered", false, unanswered === 0)}</div>
        </div>
    );
}
