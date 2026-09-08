"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

export type MetricLinkContext = {
    leId?: string;
    relationshipId?: string;
    questionnaireId?: string;
    scope?: "common" | string;
    supplierOrgId?: string;
    supplierRelName?: string;
};

export interface HomeResponsiveMetricSummaryProps {
    metrics?: QuestionStateMetrics;
    linkContext?: MetricLinkContext;
    className?: string;
}

export function HomeResponsiveMetricSummary({
    metrics = { questionnairesCount: 0, total: 0, external: 0, userInput: 0, defaultResponse: 0, unanswered: 0 },
    linkContext,
    className,
}: HomeResponsiveMetricSummaryProps) {
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

        if (linkContext.scope === "common") {
            params.set("scope", "common");
        }
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

    // ==========================================
    // 1. WIDE RENDERER HELPERS (5 Columns)
    // ==========================================
    const renderWideCell = (
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

    const renderWideTotalCell = () => {
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

    // ==========================================
    // 2. MEDIUM RENDERER HELPERS (2-Tier Compact)
    // ==========================================
    const renderMediumContent = () => {
        if (isZeroPopulation) {
            return (
                <div className="flex items-center justify-end h-full">
                    <span className="text-sm font-mono text-slate-400 dark:text-zinc-600">-</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col text-right space-y-1">
                {/* Level 1 (Primary): Total Questions & Unanswered */}
                <div className="flex items-baseline justify-end gap-3 text-xs">
                    {/* Total Questions */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref(undefined)}
                                className="font-bold font-mono text-slate-900 dark:text-slate-100 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-medium-link-total"
                            >
                                {total}
                                {questionnairesCount > 1 && (
                                    <span className="text-[11px] font-mono text-muted-foreground font-normal">/{questionnairesCount}</span>
                                )}
                            </Link>
                        ) : (
                            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                                {total}
                                {questionnairesCount > 1 && (
                                    <span className="text-[11px] font-mono text-muted-foreground font-normal">/{questionnairesCount}</span>
                                )}
                            </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-normal">questions</span>
                        <span className="sr-only">total questions</span>
                    </div>

                    {/* Unanswered */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("unanswered")}
                                className={cn(
                                    "font-bold font-mono transition-colors hover:underline hover:text-indigo-600 dark:hover:text-indigo-400",
                                    unanswered === 0 ? "text-muted-foreground/60 font-medium" : "text-slate-900 dark:text-slate-100"
                                )}
                                data-testid="metric-medium-link-unanswered"
                            >
                                {unanswered}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    "font-bold font-mono",
                                    unanswered === 0 ? "text-muted-foreground/60 font-medium" : "text-slate-900 dark:text-slate-100"
                                )}
                            >
                                {unanswered}
                            </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-normal">unanswered</span>
                    </div>
                </div>

                {/* Level 2 (Secondary): External · User Input · Default */}
                <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                    {/* External */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("external")}
                                className="font-medium font-mono text-slate-700 dark:text-zinc-300 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-medium-link-external"
                            >
                                {external}
                            </Link>
                        ) : (
                            <span className="font-medium font-mono text-slate-700 dark:text-zinc-300">{external}</span>
                        )}
                        <span className="text-muted-foreground">external</span>
                    </div>

                    <span className="text-muted-foreground/40 select-none">·</span>

                    {/* User Input */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("user_input")}
                                className="font-medium font-mono text-slate-700 dark:text-zinc-300 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-medium-link-user_input"
                            >
                                {userInput}
                            </Link>
                        ) : (
                            <span className="font-medium font-mono text-slate-700 dark:text-zinc-300">{userInput}</span>
                        )}
                        <span className="text-muted-foreground" title="User Input">user</span>
                        <span className="sr-only">user input</span>
                    </div>

                    <span className="text-muted-foreground/40 select-none">·</span>

                    {/* Default */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("default_response")}
                                className={cn(
                                    "font-medium font-mono transition-colors hover:underline hover:text-indigo-600 dark:hover:text-indigo-400",
                                    defaultResponse === 0 ? "text-muted-foreground/60" : "text-slate-700 dark:text-zinc-300"
                                )}
                                data-testid="metric-medium-link-default_response"
                            >
                                {defaultResponse}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    "font-medium font-mono",
                                    defaultResponse === 0 ? "text-muted-foreground/60" : "text-slate-700 dark:text-zinc-300"
                                )}
                            >
                                {defaultResponse}
                            </span>
                        )}
                        <span className="text-muted-foreground">default</span>
                    </div>
                </div>
            </div>
        );
    };

    // ==========================================
    // 3. NARROW RENDERER HELPERS (Stacked Compact)
    // ==========================================
    const renderNarrowContent = () => {
        if (isZeroPopulation) {
            return (
                <div className="flex items-center text-left py-0.5">
                    <span className="text-sm font-mono text-slate-400 dark:text-zinc-600">-</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col text-left space-y-1 w-full pt-0.5">
                {/* Level 1 (Primary): Total Questions · Unanswered */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    {/* Total Questions */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref(undefined)}
                                className="font-bold font-mono text-slate-900 dark:text-slate-100 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-narrow-link-total"
                            >
                                {total}
                                {questionnairesCount > 1 && (
                                    <span className="text-[11px] font-mono text-muted-foreground font-normal">/{questionnairesCount}</span>
                                )}
                            </Link>
                        ) : (
                            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                                {total}
                                {questionnairesCount > 1 && (
                                    <span className="text-[11px] font-mono text-muted-foreground font-normal">/{questionnairesCount}</span>
                                )}
                            </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-normal">questions</span>
                        <span className="sr-only">total questions</span>
                    </div>

                    <span className="text-muted-foreground/40 select-none">·</span>

                    {/* Unanswered */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("unanswered")}
                                className={cn(
                                    "font-bold font-mono transition-colors hover:underline hover:text-indigo-600 dark:hover:text-indigo-400",
                                    unanswered === 0 ? "text-muted-foreground/60 font-medium" : "text-slate-900 dark:text-slate-100"
                                )}
                                data-testid="metric-narrow-link-unanswered"
                            >
                                {unanswered}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    "font-bold font-mono",
                                    unanswered === 0 ? "text-muted-foreground/60 font-medium" : "text-slate-900 dark:text-slate-100"
                                )}
                            >
                                {unanswered}
                            </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-normal">unanswered</span>
                    </div>
                </div>

                {/* Level 2 (Secondary): External · User Input · Default */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    {/* External */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("external")}
                                className="font-medium font-mono text-slate-700 dark:text-zinc-300 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-narrow-link-external"
                            >
                                {external}
                            </Link>
                        ) : (
                            <span className="font-medium font-mono text-slate-700 dark:text-zinc-300">{external}</span>
                        )}
                        <span className="text-muted-foreground">external</span>
                    </div>

                    <span className="text-muted-foreground/40 select-none">·</span>

                    {/* User Input */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("user_input")}
                                className="font-medium font-mono text-slate-700 dark:text-zinc-300 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                data-testid="metric-narrow-link-user_input"
                            >
                                {userInput}
                            </Link>
                        ) : (
                            <span className="font-medium font-mono text-slate-700 dark:text-zinc-300">{userInput}</span>
                        )}
                        <span className="text-muted-foreground" title="User Input">user</span>
                        <span className="sr-only">user input</span>
                    </div>

                    <span className="text-muted-foreground/40 select-none">·</span>

                    {/* Default */}
                    <div className="inline-flex items-baseline gap-1">
                        {hasLink ? (
                            <Link
                                href={buildHref("default_response")}
                                className={cn(
                                    "font-medium font-mono transition-colors hover:underline hover:text-indigo-600 dark:hover:text-indigo-400",
                                    defaultResponse === 0 ? "text-muted-foreground/60" : "text-slate-700 dark:text-zinc-300"
                                )}
                                data-testid="metric-narrow-link-default_response"
                            >
                                {defaultResponse}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    "font-medium font-mono",
                                    defaultResponse === 0 ? "text-muted-foreground/60" : "text-slate-700 dark:text-zinc-300"
                                )}
                            >
                                {defaultResponse}
                            </span>
                        )}
                        <span className="text-muted-foreground">default</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div data-testid="responsive-metrics" className={cn("w-full @[600px]:w-auto shrink-0", className)}>
            {/* WIDE COMPOSITION (5 Columns) - Visible at container width >= 820px */}
            <div
                data-testid="responsive-metrics-wide"
                className="hidden @[820px]:grid grid-cols-[80px_80px_80px_75px_85px] gap-2 items-center text-right shrink-0"
            >
                {/* 1. Combined Total Questions / Questionnaires Count (e.g. 54/3) */}
                <div className="pr-3 border-r border-slate-200/80 dark:border-zinc-700/80">
                    {renderWideTotalCell()}
                </div>

                {/* 2. External Answers */}
                <div>{renderWideCell(external, "external", false)}</div>

                {/* 3. User Input */}
                <div>{renderWideCell(userInput, "user_input", false)}</div>

                {/* 4. Default Answers */}
                <div>{renderWideCell(defaultResponse, "default_response", false, defaultResponse === 0)}</div>

                {/* 5. Unanswered */}
                <div>{renderWideCell(unanswered, "unanswered", false, unanswered === 0)}</div>
            </div>

            {/* MEDIUM COMPOSITION (2-Level Compact) - Visible at container width 600px to 819px */}
            <div
                data-testid="responsive-metrics-medium"
                className="hidden @[600px]:flex @[820px]:hidden flex-col text-right shrink-0 space-y-1"
            >
                {renderMediumContent()}
            </div>

            {/* NARROW COMPOSITION (Stacked Compact) - Visible at container width < 600px */}
            <div
                data-testid="responsive-metrics-narrow"
                className="flex flex-col text-left w-full space-y-1 @[600px]:hidden"
            >
                {renderNarrowContent()}
            </div>
        </div>
    );
}
