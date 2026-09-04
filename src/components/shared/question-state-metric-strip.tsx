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
    linkContext?: QuestionStateLinkContext;
    disableLinks?: boolean;
    className?: string;
}

export function QuestionStateMetricStrip({
    metrics = { questionnairesCount: 0, total: 0, external: 0, userInput: 0, defaultResponse: 0, unanswered: 0 },
    variant = "header",
    linkContext,
    disableLinks = false,
    className,
}: QuestionStateMetricStripProps) {
    const { total, external, userInput, defaultResponse, unanswered } = metrics;

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

    if (variant === "table-row") {
        return (
            <div
                data-testid="question-state-metric-table-row"
                className={cn("grid grid-cols-[55px_65px_75px_55px_75px] gap-2 items-center text-right text-xs", className)}
            >
                <div>{renderCell(total, undefined, { isTotal: true })}</div>
                <div>{renderCell(external, "external", { colorClass: "font-mono text-sky-600 dark:text-sky-400" })}</div>
                <div>{renderCell(userInput, "user_input", { colorClass: "font-mono text-indigo-600 dark:text-indigo-400" })}</div>
                <div>{renderCell(defaultResponse, "default_response")}</div>
                <div>{renderCell(unanswered, "unanswered", { colorClass: "font-mono text-amber-600 dark:text-amber-400 font-semibold" })}</div>
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
                    <span className="text-sm">{renderCell(total, undefined, { isTotal: true })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">External</span>
                    <span className="text-xs">{renderCell(external, "external", { colorClass: "text-sky-600 dark:text-sky-400 font-bold" })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">User Input</span>
                    <span className="text-xs">{renderCell(userInput, "user_input", { colorClass: "text-indigo-600 dark:text-indigo-400 font-bold" })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Default</span>
                    <span className="text-xs">{renderCell(defaultResponse, "default_response")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Unanswered</span>
                    <span className="text-xs">{renderCell(unanswered, "unanswered", { colorClass: "text-amber-600 dark:text-amber-400 font-bold" })}</span>
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
                    {renderCell(total, undefined, { isTotal: true })}
                </span>
            </div>

            {/* External */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px] border-r border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    External
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(external, "external", { colorClass: "text-sky-600 dark:text-sky-400" })}
                </span>
            </div>

            {/* User Input */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-w-[100px] border-r border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    User Input
                </span>
                <span className="text-lg font-bold font-mono leading-none">
                    {renderCell(userInput, "user_input", { colorClass: "text-indigo-600 dark:text-indigo-400" })}
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
                    {renderCell(unanswered, "unanswered", { colorClass: "text-amber-600 dark:text-amber-400 font-semibold" })}
                </span>
            </div>
        </div>
    );
}
