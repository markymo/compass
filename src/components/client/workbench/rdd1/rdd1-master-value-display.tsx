"use client";

import React, { useState } from "react";
import { ConsoleQuestion } from "@/actions/kyc-query";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { FieldSourceBadge } from "@/components/client/fields/FieldSourceBadge";
import { FieldAttachments } from "@/components/client/fields/FieldAttachments";
import { PersonOrContactValueViewer } from "@/components/client/fields/PersonOrContactValueViewer";
import { GroupAnswerRenderer, GroupFieldData } from "@/components/client/engagement/group-answer-renderer";
import { FileText, AlertCircle, Database, Pencil, Check, X, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryPicker, isCountryField } from "@/components/client/fields/CountryPicker";
import { resolveCountry } from "@/lib/master-data/countries";
import { applyManualOverride } from "@/actions/kyc-manual-update";
import { showActionErrorToast } from "@/components/ui/copyable-error-toast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Rdd1MasterValueDisplayProps {
    question: ConsoleQuestion;
    leId: string;
    isMapped: boolean;
    raNameLookup: Record<string, string>;
    masterFields?: Array<{ fieldNo: number; options?: Array<{ label: string; value: string }> }>;
    disabled?: boolean;
    onInspect?: (fieldNo: number, name: string, customFieldId?: string) => void;
    onInlineEdit?: (val: any, src: string, date: Date) => void;
}

export function Rdd1MasterValueDisplay({
    question,
    leId,
    isMapped,
    raNameLookup,
    masterFields,
    disabled = false,
    onInspect,
    onInlineEdit,
}: Rdd1MasterValueDisplayProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const canonicalModel = question.canonicalDisplayModel;
    const isGroup = !!(question.masterQuestionGroupId && (question as any).masterDataGroupFields?.length > 0);

    const masterFieldDef = masterFields?.find((f: any) => f.fieldNo === question.masterFieldNo);
    const configuredOptions =
        (question as any).masterFieldOptions ||
        masterFieldDef?.options ||
        (canonicalModel as any)?.referenceOptions;
    const hasOptions = configuredOptions && configuredOptions.length > 0;

    const isComplexOrCollection =
        canonicalModel?.value?.kind === "collection" ||
        canonicalModel?.value?.kind === "party" ||
        canonicalModel?.value?.kind === "partyRef" ||
        canonicalModel?.value?.kind === "address" ||
        canonicalModel?.value?.kind === "addressRef" ||
        Boolean(question.masterFieldNo && [4, 5, 27, 28, 29, 30].includes(question.masterFieldNo));

    const isCountry = isCountryField(
        question.masterFieldNo,
        canonicalModel?.label || question.text
    );

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

    const handleStartEdit = () => {
        if (!isMapped || disabled || question.status === "RELEASED") return;
        const currentVal =
            question.masterDataValue != null
                ? String(question.masterDataValue)
                : canonicalModel?.textSummary || "";
        setEditValue(currentVal);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditValue("");
    };

    const handleSaveEdit = async () => {
        if (!isMapped || isSaving) return;
        const targetFieldId = question.masterFieldNo || (question as any).customFieldDefinitionId;
        if (!targetFieldId) return;

        let finalValue = editValue;
        if (hasOptions) {
            const trimmed = (editValue || '').trim().toLowerCase();
            const matched = configuredOptions.find((opt: any) =>
                String(opt.value).toLowerCase() === trimmed ||
                String(opt.label).toLowerCase() === trimmed
            );
            if (matched) {
                finalValue = matched.value;
            } else if (isCountry) {
                const resolved = resolveCountry(editValue);
                if (!resolved) {
                    toast.error("Invalid country. Please select a valid country from the dropdown.");
                    return;
                }
                finalValue = resolved.code;
            }
        } else if (isCountry) {
            const resolved = resolveCountry(editValue);
            if (!resolved) {
                toast.error("Invalid country. Please select a valid country from the dropdown.");
                return;
            }
            finalValue = resolved.code;
        }

        setIsSaving(true);
        try {
            const res = await applyManualOverride(leId, targetFieldId, finalValue, "RDD1 inline edit");
            if (res.success) {
                toast.success("Value updated");
                onInlineEdit?.(finalValue, "USER_INPUT", new Date());
                setIsEditing(false);
            } else {
                showActionErrorToast(res, "Update failed");
            }
        } catch (err) {
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col justify-between h-full space-y-2">
            {/* Header: Item Count + Source Badge + Actions */}
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

                {/* Bug R17, R21, R24: Active edit action in RDD1 mode */}
                {isMapped && question.status !== "RELEASED" && !disabled && (
                    <div className="flex items-center gap-1 shrink-0">
                        {isComplexOrCollection ? (
                            <button
                                type="button"
                                data-testid={`rdd1-edit-btn-${question.id}`}
                                onClick={() => {
                                    const fNo = question.masterFieldNo || 0;
                                    const customId = (question as any).customFieldDefinitionId;
                                    const fieldName =
                                        canonicalModel?.label || (question as any).text;
                                    onInspect?.(fNo, fieldName, customId);
                                }}
                                title="Edit details in sidebar"
                                className="p-1 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 text-xs font-semibold"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                            </button>
                        ) : isGroup ? (
                            <button
                                type="button"
                                data-testid={`rdd1-inspect-group-btn-${question.id}`}
                                onClick={() => {
                                    const firstField = (question as any).masterDataGroupFields?.[0];
                                    if (firstField) {
                                        onInspect?.(firstField.fieldNo, firstField.fieldName);
                                    }
                                }}
                                title="Inspect group fields in sidebar"
                                className="p-1 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 text-xs font-semibold"
                            >
                                <PanelLeftOpen className="h-3.5 w-3.5" />
                                <span>Inspect</span>
                            </button>
                        ) : !isEditing ? (
                            <button
                                type="button"
                                data-testid={`rdd1-edit-btn-${question.id}`}
                                onClick={handleStartEdit}
                                title="Edit master field"
                                className="p-1 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 text-xs font-semibold"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                            </button>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Content Container (Master Record Look & Feel) */}
            <div className="w-full rounded-md border border-border bg-card text-card-foreground shadow-xs overflow-hidden">
                {!isMapped ? (
                    <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2 bg-muted/20">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Mapping required — select a Master Field to populate canonical responses.</span>
                    </div>
                ) : isEditing ? (
                    <div className="p-3 bg-muted/20 border-b border-border flex items-center gap-2">
                        {hasOptions || isCountry ? (
                            <div className="flex-1">
                                <CountryPicker
                                    value={editValue}
                                    options={hasOptions ? configuredOptions : undefined}
                                    placeholder={isCountry ? "Select country..." : "Select option..."}
                                    searchPlaceholder={isCountry ? "Search country or code..." : "Search options..."}
                                    onChange={(code, name) => setEditValue(code)}
                                    disabled={isSaving}
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit();
                                    if (e.key === "Escape") handleCancelEdit();
                                }}
                                className="text-xs h-8 flex-1 bg-background"
                                placeholder="Enter value..."
                                disabled={isSaving}
                                autoFocus
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            title="Save value"
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted shrink-0"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            title="Cancel"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : isGroup ? (
                    <div className="p-3">
                        <GroupAnswerRenderer
                            groupLabel=""
                            fields={(question as any).masterDataGroupFields as GroupFieldData[]}
                            raNameLookup={raNameLookup}
                            displayStyle={question.masterDataGroupDisplayStyle}
                            onInspectField={(fNo, fName) => onInspect?.(fNo, fName)}
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
                                            displayMask={(item.value as any).displayMask}
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
                        <FieldValueRenderer field={canonicalModel} layout="row" itemLimit={10} />
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
