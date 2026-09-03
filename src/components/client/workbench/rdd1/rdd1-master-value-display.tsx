"use client";

import React from "react";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { FieldSourceBadge } from "@/components/client/fields/FieldSourceBadge";
import { FieldAttachments } from "@/components/client/fields/FieldAttachments";
import { PersonOrContactValueViewer } from "@/components/client/fields/PersonOrContactValueViewer";
import { GroupAnswerRenderer } from "@/components/client/engagement/group-answer-renderer";
import { FileText, AlertCircle, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rdd1MasterValueDisplayProps {
    question: ConsoleQuestion;
    leId: string;
    isMapped: boolean;
    raNameLookup: Record<string, string>;
    disabled?: boolean;
}

export function Rdd1MasterValueDisplay({
    question,
    leId,
    isMapped,
    raNameLookup,
    disabled = false
}: Rdd1MasterValueDisplayProps) {
    const canonicalModel = question.canonicalDisplayModel;
    const isGroup = !!(question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0);

    // Calculate items count
    let itemCount = 0;
    if (canonicalModel?.value?.kind === "collection") {
        itemCount = canonicalModel.value.items.length;
    } else if (Array.isArray(question.masterDataValue)) {
        itemCount = question.masterDataValue.length;
    } else if (question.masterDataValue != null && question.masterDataValue !== "") {
        itemCount = 1;
    }

    const source = canonicalModel?.source || (question as any).masterDataSource;

    return (
        <div className="flex flex-col justify-between h-full space-y-2">
            {/* Header: Item Count + Source Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {isMapped && itemCount > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
                        </span>
                    )}

                    {isMapped && source && (
                        <FieldSourceBadge source={source} showLastValidated={true} />
                    )}
                </div>
            </div>

            {/* Content Container (Master Record Look & Feel) */}
            <div className="w-full rounded-md border border-border bg-card text-card-foreground shadow-xs overflow-hidden">
                {!isMapped ? (
                    <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2 bg-muted/20">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Mapping required — select a Master Field to populate canonical responses.</span>
                    </div>
                ) : isGroup ? (
                    <div className="p-3">
                        <GroupAnswerRenderer
                            groupLabel=""
                            fields={(question as any).masterDataGroupFields}
                            raNameLookup={raNameLookup}
                            displayStyle={question.masterDataGroupDisplayStyle}
                        />
                    </div>
                ) : canonicalModel?.value?.kind === "collection" ? (
                    <div className="divide-y divide-border">
                        {canonicalModel.value.items.map((item, idx) => (
                            <div key={idx} className="p-3 flex items-start justify-between gap-4 min-h-[44px]">
                                <div className="flex-1 min-w-0">
                                    {item.value.kind === "party" || item.value.kind === "partyRef" ? (
                                        <PersonOrContactValueViewer
                                            value={item.value.kind === "partyRef" ? (item.value as any).resolved : item.value.data}
                                            partyLabel={(item.value as any).partyLabel}
                                            layout="row"
                                            attachments={item.attachments}
                                        />
                                    ) : (
                                        <span className="text-sm text-foreground">
                                            {item.value.kind === "scalar"
                                                ? item.value.display
                                                : "summary" in item.value
                                                ? (item.value as any).summary
                                                : "—"}
                                        </span>
                                    )}
                                </div>
                                {item.source && (
                                    <div className="shrink-0 mt-0.5">
                                        <FieldSourceBadge source={item.source} showLastValidated={false} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : canonicalModel ? (
                    <div className="p-3 space-y-2">
                        <FieldValueRenderer field={canonicalModel} itemLimit={10} />
                        {canonicalModel.attachments && canonicalModel.attachments.length > 0 && (
                            <div className="pt-2 border-t border-border">
                                <FieldAttachments
                                    clientLEId={leId}
                                    fieldNo={canonicalModel.fieldNo}
                                    attachments={canonicalModel.attachments.map((a: any) => ({
                                        ...a,
                                        documentId: a.documentId || a.id || 'doc-1',
                                        displayName: a.displayName || a.fileName || 'Document'
                                    }))}
                                    mode="read-only"
                                    isEditable={false}
                                />
                            </div>
                        )}
                    </div>
                ) : question.masterDataValue != null && question.masterDataValue !== "" ? (
                    <div className="p-3 text-sm text-foreground font-medium">
                        {Array.isArray(question.masterDataValue) ? (
                            <ul className="list-disc pl-4 space-y-1">
                                {question.masterDataValue.map((val: any, idx: number) => (
                                    <li key={idx}>
                                        {typeof val === "object" ? val.name || JSON.stringify(val) : String(val)}
                                    </li>
                                ))}
                            </ul>
                        ) : typeof question.masterDataValue === "object" ? (
                            JSON.stringify(question.masterDataValue)
                        ) : (
                            String(question.masterDataValue)
                        )}
                    </div>
                ) : (
                    <div className="p-3 text-xs text-muted-foreground italic bg-muted/10">
                        No canonical data in Master Record yet.
                    </div>
                )}
            </div>
        </div>
    );
}
