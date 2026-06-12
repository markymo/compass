"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { SOURCE_OPTIONS } from "@/lib/source-display";
import { DataInspectorPanel } from "./data-inspector-panel";

interface AddressFieldSourceMappingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetFieldNo: number;
    targetFieldName: string;
    resolvedDefaults?: {
        gleifLei: string;
        chCompanyNo: string;
        frSiren: string;
    };
    fieldDefinitions: any[];
}

export function AddressFieldSourceMappingModal({
    open,
    onOpenChange,
    targetFieldNo,
    targetFieldName,
    resolvedDefaults,
    fieldDefinitions
}: AddressFieldSourceMappingModalProps) {
    const [sourceValue, setSourceValue] = useState<string>(SOURCE_OPTIONS[0].value);
    
    const selectedSource = SOURCE_OPTIONS.find(o => o.value === sourceValue) || SOURCE_OPTIONS[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0 bg-white dark:bg-zinc-950">
                    <DialogTitle className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                        Map Address Field: {targetFieldName}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Select a source registry to browse for address payloads.
                    </DialogDescription>
                    
                    <div className="pt-4 grid gap-2">
                        <Label htmlFor="sourceSelect" className="text-xs">Source Registry</Label>
                        <Select value={sourceValue} onValueChange={setSourceValue}>
                            <SelectTrigger className="w-[300px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-4 bg-slate-50 dark:bg-zinc-900/20">
                    {resolvedDefaults ? (
                        <DataInspectorPanel
                            key={sourceValue}
                            sourceType={selectedSource.sourceType}
                            sourceReference={selectedSource.sourceReference}
                            existingMappings={[]}
                            allSourceMappings={[]}
                            currentFieldNo={targetFieldNo}
                            readOnly={false}
                            resolvedDefaults={resolvedDefaults}
                            fieldDefinitions={fieldDefinitions}
                            initialTargetFieldNo={targetFieldNo}
                            onSelectPath={() => {}}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
