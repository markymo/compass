"use client";

import React, { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { getCCPartyUsage } from "@/actions/cc-party-actions";
import { getCCAddressUsage } from "@/actions/cc-address-actions";

interface UsageItem {
    fieldNo: number;
    fieldName: string;
}

interface SharedResourceUsageNoticeProps {
    resourceType: "PARTY" | "ADDRESS";
    displayTypeLabel?: "person" | "organisation" | "party" | "address";
    resourceId: string;
    clientLEId: string;
    currentFieldNo: number;
}

export function SharedResourceUsageNotice({
    resourceType,
    displayTypeLabel,
    resourceId,
    clientLEId,
    currentFieldNo
}: SharedResourceUsageNoticeProps) {
    const [usages, setUsages] = useState<UsageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(false);

        const fetchUsage = async () => {
            try {
                let data: UsageItem[] = [];
                if (resourceType === "PARTY") {
                    const map = await getCCPartyUsage(clientLEId);
                    data = map[resourceId] || [];
                } else {
                    const map = await getCCAddressUsage(clientLEId);
                    const summary = map[resourceId];
                    if (summary) {
                        data = [
                            ...summary.fieldUsages,
                            ...summary.partyUsages.map((p, idx) => ({
                                fieldNo: -(idx + 1), // Fake negative ID for React keys to not conflict
                                fieldName: `Party record: ${p.partyLabel} (${p.usageKind.replace(/_/g, ' ')})`
                            }))
                        ];
                    }
                }
                if (isMounted) {
                    setUsages(data);
                }
            } catch (err) {
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchUsage();

        return () => {
            isMounted = false;
        };
    }, [resourceType, resourceId, clientLEId]);

    const fallbackLabel = displayTypeLabel || (resourceType === "PARTY" ? "party" : "address");
    const title = resourceType === "PARTY" 
        ? `Editing shared ${fallbackLabel}` 
        : `Editing shared address`;

    if (loading) {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500 italic">Loading usage information...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex items-center gap-1.5 mb-1">
                    <Database className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">{title}</span>
                </div>
                <p className="text-xs text-slate-500">Usage information is not available.</p>
            </div>
        );
    }

    const isOnlyHere = usages.length === 1 && usages[0].fieldNo === currentFieldNo;

    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <div className="bg-slate-100/50 border-b border-slate-100 p-3 px-4">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" /> {title}
                </span>
            </div>
            <div className="p-4 text-sm space-y-3">
                <p className="text-slate-600 text-xs">
                    This is a shared {fallbackLabel}. Changes you make may appear anywhere this {fallbackLabel} is currently referenced.
                </p>

                <div className="space-y-1 mt-2">
                    {usages.length === 0 ? (
                        <div className="text-slate-500 text-xs italic">Usage information is not available.</div>
                    ) : isOnlyHere ? (
                        <div className="font-medium text-slate-700 text-xs tracking-wide">
                            Currently only used here.
                        </div>
                    ) : (
                        <>
                            <div className="font-medium text-slate-700 text-xs tracking-wide mb-1.5">
                                Currently referenced in {usages.length} place{usages.length !== 1 ? 's' : ''}:
                            </div>
                            <div className="flex flex-col gap-1">
                                {usages.map(u => (
                                    <div key={u.fieldNo} className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        <span>{u.fieldNo < 0 ? u.fieldName : `Field reference ${u.fieldNo} \u2014 ${u.fieldName}`}</span>
                                        {u.fieldNo === currentFieldNo && (
                                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-1">Current</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
