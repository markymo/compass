"use client"

import { useState, useTransition, useEffect } from "react";
import { updateStandingDataProperty } from "@/actions/client-le";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, HelpCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { GraphNodePicker, GraphNodePickerSelection } from "@/components/client/graph/graph-node-picker";


interface StandingDataPropertyProps {
    clientLEId: string;
    propertyKey: string;
    label: string;
    initialData?: {
        value: any;
        status: string;
        updatedAt: string;
    } | null;
    requiredBy?: string[];
    /**
     * If provided, renders a GraphNodePicker instead of a text Input.
     * Sourced from the field's MasterFieldGraphBinding.
     */
    graphBinding?: {
        graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
        filterEdgeType?: string | null;
        filterActiveOnly?: boolean;
        writeBackEdgeType?: string | null;
        allowCreate?: boolean;
        pickerLabel?: string | null;
        isMultiValue?: boolean;
    } | null;
}

export function StandingDataProperty({
    clientLEId,
    propertyKey,
    label,
    initialData,
    requiredBy = [],
    graphBinding = null,
}: StandingDataPropertyProps) {
    const [value, setValue] = useState(initialData?.value || "");
    const [status, setStatus] = useState(initialData?.status || "MISSING");
    const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt || "");
    const [isPending, startTransition] = useTransition();
    const [isSaving, setIsSaving] = useState(false);

    // Update status if value is present but status is missing
    useEffect(() => {
        if (!initialData?.status && value) {
            setStatus("VERIFIED");
        }
    }, []);

    async function handleBlur() {
        if (value === initialData?.value) return;

        setIsSaving(true);
        startTransition(async () => {
            const res = await updateStandingDataProperty(clientLEId, propertyKey, {
                value,
                status: "VERIFIED" // Auto-verify on manual entry for now
            });

            if (res.success && res.propertyData) {
                setStatus(res.propertyData.status);
                setUpdatedAt(res.propertyData.updatedAt);
            }
            setIsSaving(false);
        });
    }

    const getStatusIcon = () => {
        switch (status) {
            case "VERIFIED": return <CheckCircle2 className="h-3 w-3 text-green-600" />;
            default: return <HelpCircle className="h-3 w-3 text-slate-400" />;
        }
    };

    const getStatusClass = () => {
        switch (status) {
            case "VERIFIED": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
            default: return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
        }
    };

    return (
        <div className="group border rounded-lg p-4 bg-white dark:bg-slate-950 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {label}
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold py-0 h-4 px-1.5", getStatusClass())}>
                            <span className="mr-1">{getStatusIcon()}</span>
                            {status}
                        </Badge>
                    </label>
                    {updatedAt && (
                        <p className="text-[10px] text-slate-400">
                            Last changed {new Date(updatedAt).toLocaleDateString()}
                        </p>
                    )}
                </div>

                {requiredBy.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                        {requiredBy.map((fi: any) => (
                            <Badge key={fi} variant="secondary" className="text-[9px] h-4 px-1 opacity-70">
                                {fi}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative">
                {graphBinding ? (
                    // ── Graph Node Picker mode ────────────────────────────
                    <GraphNodePicker
                        clientLEId={clientLEId}
                        graphNodeType={graphBinding.graphNodeType}
                        filterEdgeType={graphBinding.filterEdgeType}
                        filterActiveOnly={graphBinding.filterActiveOnly ?? true}
                        allowCreate={graphBinding.allowCreate ?? true}
                        pickerLabel={graphBinding.pickerLabel}
                        isMultiValue={graphBinding.isMultiValue ?? false}
                        disabled={isPending}
                        selectedNodeIds={
                            Array.isArray(value)
                                ? value
                                : value ? [value] : []
                        }
                        onSelect={async (item: GraphNodePickerSelection) => {
                            // Build the value payload appropriate for the binding type
                            const payloadValue =
                                graphBinding.graphNodeType === "PERSON"
                                    ? item.personId
                                    : graphBinding.graphNodeType === "LEGAL_ENTITY"
                                        ? item.legalEntityId
                                        : item.addressId;

                            if (!payloadValue) return;

                            // For multi-value, append; for single, replace
                            const nextValue = graphBinding.isMultiValue
                                ? [...(Array.isArray(value) ? value : value ? [value] : []), item.nodeId]
                                : item.nodeId;

                            setValue(nextValue);
                            setIsSaving(true);
                            startTransition(async () => {
                                const res = await updateStandingDataProperty(
                                    clientLEId,
                                    propertyKey,
                                    { value: payloadValue, status: "ASSERTED" }
                                );
                                if (res.success && res.propertyData) {
                                    setStatus(res.propertyData.status);
                                    setUpdatedAt(res.propertyData.updatedAt);
                                }
                                setIsSaving(false);
                            });
                        }}
                        onDeselect={async (nodeId: string) => {
                            const nextValue = Array.isArray(value)
                                ? value.filter((id: string) => id !== nodeId)
                                : [];
                            setValue(nextValue);
                        }}
                    />
                ) : (
                    // ── Standard text input mode ──────────────────────────
                    <>
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onBlur={handleBlur}
                            placeholder={`Enter ${label.toLowerCase()}...`}
                            className={cn(
                                "h-9 pr-8 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950",
                                isSaving && "opacity-70"
                            )}
                        />
                        <div className="absolute right-2.5 top-2.5">
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            ) : value !== initialData?.value ? (
                                <Save className="h-4 w-4 text-slate-300" />
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
