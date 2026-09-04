"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

export type QuestionStateLinkContext = {
    leId?: string;
    relationshipId?: string;
    questionnaireId?: string;
    relationshipName?: string;
    questionnaireName?: string;
};

export interface QuestionStateMetricStripProps {
    metrics?: QuestionStateMetrics;
    variant?: "header" | "card-row" | "table-row";
    showQuestionnairesCount?: boolean;
    linkContext?: QuestionStateLinkContext;
    disableLinks?: boolean;
    className?: string;
}

export function QuestionStateMetricHeader({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col gap-1 shrink-0", className)} data-testid="question-state-metric-header-grouped">
            {/* Tier 1: Group Headers */}
            <div className="grid grid-cols-[80px_344px] gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-right pr-3 border-r border-border text-foreground">Questions</span>
                <span className="text-center text-muted-foreground border-b border-border pb-0.5">Answers</span>
            </div>

            {/* Tier 2: Sub-column Labels */}
            <div className="grid grid-cols-[80px_80px_80px_75px_85px] gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider items-center text-right">
                <div className="pr-3 border-r border-border justify-end flex">
                    <span className="font-bold text-foreground">Total</span>
                </div>
                <span>External</span>
                <span>User Input</span>
                <span>Default</span>
                <span>Unanswered</span>
            </div>
        </div>
    );
}

export function QuestionStateMetricStrip({
    metrics = { questionnairesCount: 0, total: 0, external: 0, userInput: 0, defaultResponse: 0, unanswered: 0 },
    variant = "header",
    showQuestionnairesCount = false,
    linkContext,
    disableLinks = false,
    className,
}: QuestionStateMetricStripProps) {
    const { questionnairesCount = 0, total, external, userInput, defaultResponse, unanswered } = metrics;

    const buildHref = (answerState?: "external" | "user_input" | "default_response" | "unanswered") => {
        if (disableLinks || !linkContext?.leId) return undefined;
        const params = new URLSearchParams();

        if (linkContext.relationshipId) {
            params.set("relationshipId", linkContext.relationshipId);
        } else if (linkContext.relationshipName) {
            params.set("rel", linkContext.relationshipName);
        }

        if (linkContext.questionnaireId) {
            params.set("questionnaireId", linkContext.questionnaireId);
        } else if (linkContext.questionnaireName) {
            params.set("q", linkContext.questionnaireName);
        }

        if (answerState) {
            params.set("answerState", answerState);
        }

        const qs = params.toString();
        return `/app/le/${linkContext.leId}/workbench4${qs ? `?${qs}` : ""}`;
    };

    const renderCell = (
        val: number,
        answerState: "external" | "user_input" | "default_response" | "unanswered" | undefined,
        options: { isTotal?: boolean; isZeroMuted?: boolean; colorClass?: string } = {}
    ) => {
        const { isTotal = false, isZeroMuted = true, colorClass } = options;
        const isMuted = isZeroMuted && val === 0;

        const textClass = isTotal
            ? "font-bold font-mono text-slate-900 dark:text-slate-100"
            : colorClass && !isMuted
            ? colorClass
            : isMuted
            ? "font-medium font-mono text-slate-300 dark:text-zinc-700"
            : "font-medium font-mono text-slate-700 dark:text-zinc-300";

        const href = buildHref(answerState);

        if (href) {
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
        const hasQuestionnairesCount = showQuestionnairesCount && questionnairesCount > 0;

        const content = hasQuestionnairesCount ? (
            <span className="inline-flex items-baseline justify-end gap-0.5">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{total}</span>
                <span className="text-xs font-mono text-slate-400">/</span>
                <span className="text-xs font-medium font-mono text-slate-500 dark:text-zinc-400">{questionnairesCount}</span>
            </span>
        ) : (
            renderCell(total, undefined, { isTotal: true })
        );

        const href = buildHref(undefined);
        if (href && hasQuestionnairesCount) {
            return (
                <Link
                    href={href}
                    className="hover:underline focus:outline-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    data-testid="metric-link-total"
                >
                    {content}
                </Link>
            );
        }

        return content;
    };

    if (variant === "table-row") {
        return (
            <div
                data-testid="question-state-metric-table-row"
                className={cn("grid grid-cols-[80px_80px_80px_75px_85px] gap-2 items-center text-right shrink-0", className)}
            >
                {/* 1. Total (with right separator matching Home) */}
                <div className="pr-3 border-r border-slate-200/80 dark:border-zinc-700/80">
                    {renderTotalCell()}
                </div>
                {/* 2. External */}
                <div>{renderCell(external, "external")}</div>
                {/* 3. User Input */}
                <div>{renderCell(userInput, "user_input")}</div>
                {/* 4. Default */}
                <div>{renderCell(defaultResponse, "default_response")}</div>
                {/* 5. Unanswered */}
                <div>{renderCell(unanswered, "unanswered")}</div>
            </div>
        );
    }

    if (variant === "card-row") {
        return (
            <div
                data-testid="question-state-metric-card-row"
                className={cn("flex flex-wrap items-center gap-4 text-xs", className)}
            >
                <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total</span>
                    <span className="text-sm">{renderTotalCell()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">External</span>
                    <span className="text-xs">{renderCell(external, "external")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">User Input</span>
                    <span className="text-xs">{renderCell(userInput, "user_input")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Default</span>
                    <span className="text-xs">{renderCell(defaultResponse, "default_response")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Unanswered</span>
                    <span className="text-xs">{renderCell(unanswered, "unanswered")}</span>
                </div>
            </div>
        );
    }

    // Default: "header" variant (clean banner strip replacing ProgressTracker variant="v2")
    return (
        <div
            data-testid="question-state-metric-header"
            className={cn(
                "flex flex-wrap items-stretch gap-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden",
                className
            )}
        >
            {/* Total Section */}
            <div className="flex flex-col items-center justify-center px-6 py-3 bg-slate-50/70 dark:bg-zinc-800/40 border-r border-slate-100 dark:border-zinc-800 min-w-[100px]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                    Total
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                    {renderTotalCell()}
                </span>
            </div>

            {/* External */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px] border-r border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    External
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(external, "external")}
                </span>
            </div>

            {/* User Input */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px] border-r border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    User Input
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(userInput, "user_input")}
                </span>
            </div>

            {/* Default */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px] border-r border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Default
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(defaultResponse, "default_response")}
                </span>
            </div>

            {/* Unanswered */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px]">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Unanswered
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(unanswered, "unanswered")}
                </span>
            </div>
        </div>
    );
}
