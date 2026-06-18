import React, { useEffect, useState } from "react";
import { getCCParties } from "@/actions/cc-party-actions";
import { Loader2, User, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PartyRefValue } from "@/lib/master-data/party-value";
import { getPartySummary } from "@/lib/master-data/party-value";

interface PartyRefValueEditorProps {
    value?: PartyRefValue | null;
    onChange: (newValue: PartyRefValue | null) => void;
    disabled?: boolean;
    clientLEId: string;
}

export function PartyRefValueEditor({ value, onChange, disabled, clientLEId }: PartyRefValueEditorProps) {
    const [parties, setParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getCCParties(clientLEId).then(data => {
            if (active) {
                setParties(data);
                setLoading(false);
            }
        }).catch(err => {
            console.error("Failed to load curated parties", err);
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [clientLEId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading saved parties...</span>
            </div>
        );
    }

    if (parties.length === 0) {
        return (
            <div className="text-sm text-slate-500 italic p-4 bg-slate-50 border border-slate-100 rounded-md text-center">
                No saved parties found for this client. You can save parties from existing fields.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Select Saved Party
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {parties.map((p) => {
                    const isSelected = value?.ccPartyId === p.id;
                    const summary = getPartySummary(p.data);
                    const partyType = p.data.partyType;
                    const subType = p.data.partySubType;
                    const Icon = partyType === "ORGANISATION" ? Building2 : User;

                    return (
                        <div 
                            key={p.id}
                            onClick={() => {
                                if (!disabled) {
                                    onChange(isSelected ? null : { ccPartyId: p.id });
                                }
                            }}
                            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all ${
                                isSelected 
                                ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500" 
                                : disabled 
                                    ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" 
                                    : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-md ${isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium ${isSelected ? "text-indigo-900" : "text-slate-700"}`}>
                                        {summary}
                                    </span>
                                    {(subType || partyType) && (
                                        <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                                            {subType || partyType}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {p.originType === "PROMOTED" && (
                                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 uppercase">
                                        Saved
                                    </Badge>
                                )}
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                                }`}>
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
