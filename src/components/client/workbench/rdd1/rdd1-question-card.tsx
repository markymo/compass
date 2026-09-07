"use client";

import React from "react";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { Rdd1QuestionSummary } from "./rdd1-question-summary";
import { Rdd1MappingSummary } from "./rdd1-mapping-summary";
import { Rdd1MasterValueDisplay } from "./rdd1-master-value-display";
import { cn } from "@/lib/utils";

interface Rdd1QuestionCardProps {
    question: ConsoleQuestion;
    leId: string;
    masterFields: Array<{ fieldNo: number; label: string }>;
    masterGroups: Array<{ key: string; label: string }>;
    customFields: Array<{ id: string; label: string }>;
    raNameLookup: Record<string, string>;
    onInspectMapping: () => void;
    disabled?: boolean;
}

export function Rdd1QuestionCard({
    question,
    leId,
    masterFields,
    masterGroups,
    customFields,
    raNameLookup,
    onInspectMapping,
    disabled = false
}: Rdd1QuestionCardProps) {
    const isMapped = !!(
        question.masterFieldNo ||
        question.masterQuestionGroupId ||
        (question as any).customFieldDefinitionId
    );

    return (
        <div
            data-testid={`rdd1-card-${question.id}`}
            className={cn(
                "@container w-full rounded-xl border border-border bg-card p-4 shadow-sm transition-all text-card-foreground",
                "hover:border-indigo-500/40 hover:shadow-md",
                !isMapped && "bg-muted/10 border-dashed"
            )}
        >
            {/* 
              Responsive Layout:
              - Wide (@2xl): 3 columns (Question: 4 / Mapping: 3 / Master Value: 5)
              - Medium (@md to @2xl): 2 columns + 1 full-width row (Question: 1 / Mapping: 1, Master Value: 2 full width)
              - Small (< @md): 1 column vertical stack
            */}
            <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-12 gap-4 items-start w-full">
                {/* 1. Question (Left) */}
                <div
                    data-testid={`rdd1-stage-question-${question.id}`}
                    className="w-full @2xl:col-span-4"
                >
                    <Rdd1QuestionSummary
                        question={question}
                        isMapped={isMapped}
                    />
                </div>

                {/* 2. Master Data Mapping (Center) */}
                <div
                    data-testid={`rdd1-stage-mapping-${question.id}`}
                    className="w-full @2xl:col-span-3"
                >
                    <Rdd1MappingSummary
                        question={question}
                        masterFields={masterFields}
                        masterGroups={masterGroups}
                        customFields={customFields}
                        isMapped={isMapped}
                        onInspectMapping={onInspectMapping}
                        disabled={disabled}
                    />
                </div>

                {/* 3. Master Value (Right) */}
                <div
                    data-testid={`rdd1-stage-value-${question.id}`}
                    className="w-full @md:col-span-2 @2xl:col-span-5"
                >
                    <Rdd1MasterValueDisplay
                        question={question}
                        leId={leId}
                        isMapped={isMapped}
                        raNameLookup={raNameLookup}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
}
