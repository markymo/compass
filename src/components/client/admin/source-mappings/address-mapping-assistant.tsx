"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, MapPin, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { detectAddressWithAI } from "@/actions/ai-address";
import { AddressDetectionResult, buildRelativeTransformConfig } from "@/lib/address-detector";
import { upsertSourceMapping } from "@/actions/source-mappings";

export interface AddressMappingAssistantProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Source context
    sourceType: string;
    sourceReference: string | null;
    sourcePath: string;
    nodeValue: any;
    heuristicResult?: AddressDetectionResult | null;
    // System context
    fieldDefinitions: any[];
    // Pre-selection for field-first mode
    initialTargetFieldNo?: number | null;
    onSaved?: () => void;
}

export function AddressMappingAssistant({
    open,
    onOpenChange,
    sourceType,
    sourceReference,
    sourcePath,
    nodeValue,
    heuristicResult,
    fieldDefinitions,
    initialTargetFieldNo,
    onSaved
}: AddressMappingAssistantProps) {
    const router = useRouter();

    const formatFieldPrefillName = (path: string): string => {
        const lastPart = path.split('.').pop() || 'Address';
        if (lastPart.toLowerCase() === 'siege') return 'Registered Address';
        return lastPart
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_-]+/g, ' ')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    };

    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<AddressDetectionResult | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiCache] = useState<Map<string, AddressDetectionResult>>(new Map());

    const [actionMode, setActionMode] = useState<"create" | "map">("map");
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldCategory] = useState("Address Information");
    const [newFieldDescription, setNewFieldDescription] = useState("");
    const [selectedFieldNo, setSelectedFieldNo] = useState<number | null>(null);
    const [fieldSearchTerm, setFieldSearchTerm] = useState("");
    const [isReviewingMapping, setIsReviewingMapping] = useState(false);

    useEffect(() => {
        if (!open) {
            setIsReviewingMapping(false);
            return;
        }

        setAiResult(null);
        setAiError(null);
        setIsReviewingMapping(false);
        
        if (initialTargetFieldNo) {
            setActionMode("map");
            setSelectedFieldNo(initialTargetFieldNo);
        } else {
            setActionMode("create");
            setSelectedFieldNo(null);
        }

        setNewFieldName(formatFieldPrefillName(sourcePath));
        setNewFieldDescription(`Imported address structure from source payload at ${sourcePath}.`);
        setFieldSearchTerm("");

        if (heuristicResult && heuristicResult.score >= 3 && heuristicResult.score <= 7) {
            const cacheKey = `${sourceType}:${sourceReference || "NONE"}:${sourcePath}:${JSON.stringify(nodeValue)}`;
            if (aiCache.has(cacheKey)) {
                setAiResult(aiCache.get(cacheKey) || null);
                return;
            }

            setAiLoading(true);
            detectAddressWithAI({
                sourceType,
                sourceReference,
                nodePath: sourcePath,
                nodeValue: nodeValue,
                nearbyChildKeys: Object.keys(nodeValue || {})
            }).then(res => {
                if (res.success && res.result) {
                    setAiResult(res.result);
                    aiCache.set(cacheKey, res.result);
                } else {
                    setAiError(res.error || "Failed to analyze with AI");
                }
            }).catch(e => {
                setAiError(e.message || "Failed to analyze with AI");
            }).finally(() => {
                setAiLoading(false);
            });
        }
    }, [open, sourcePath, nodeValue, heuristicResult, initialTargetFieldNo]);

    const currentResult = aiResult || heuristicResult;

    const relativeConfig = open && currentResult && nodeValue
        ? buildRelativeTransformConfig(nodeValue, currentResult.detectedFields)
        : null;

    const getSampleForKeys = (keys: string[]): string => {
        if (!keys || keys.length === 0) return "";
        const samples: string[] = [];
        for (const k of keys) {
            const val = nodeValue?.[k];
            if (Array.isArray(val)) {
                samples.push(...val.map(String));
            } else if (val != null) {
                samples.push(String(val));
            }
        }
        return samples.join(', ');
    };

    const getSampleForKey = (key: string | null): string => {
        if (!key) return "";
        const val = nodeValue?.[key];
        if (Array.isArray(val)) {
            return val.join(', ');
        }
        return val != null ? String(val) : "";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <MapPin className="h-5 w-5 text-indigo-500" />
                        {isReviewingMapping ? "Review Address Mapping" : "Address detected"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        {isReviewingMapping 
                            ? "Please review the source-to-field mappings before persistence."
                            : "We think this source object represents an address structure."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1 flex-1">
                    {isReviewingMapping ? (
                        <div className="space-y-4">
                            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-3.5 text-xs space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Target Field:</span>
                                    <span className="font-semibold text-slate-800">
                                        {fieldDefinitions.find(f => f.fieldNo === selectedFieldNo)?.fieldName} (Field #{selectedFieldNo})
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Source Path:</span>
                                    <span className="font-mono text-[10px] text-slate-700">
                                        {sourcePath}
                                    </span>
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                                <div className="bg-slate-50 px-3.5 py-2 font-semibold text-slate-700 border-b border-slate-100">
                                    Source-to-Field Mappings
                                </div>
                                <div className="divide-y divide-slate-100 bg-white">
                                    <div className="p-3 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-900">Address Lines</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {relativeConfig?.addressLines?.length > 0 
                                                    ? relativeConfig.addressLines.map((k: string) => `${sourcePath}.${k}`).join(' & ')
                                                    : 'Not mapped'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 italic">
                                            Sample: {getSampleForKeys(relativeConfig?.addressLines || []) || '—'}
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-900">Locality</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {relativeConfig?.locality ? `${sourcePath}.${relativeConfig.locality}` : 'Not mapped'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 italic">
                                            Sample: {getSampleForKey(relativeConfig?.locality) || '—'}
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-900">Region</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {relativeConfig?.region ? `${sourcePath}.${relativeConfig.region}` : 'Not mapped'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 italic">
                                            Sample: {getSampleForKey(relativeConfig?.region) || '—'}
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-900">Postcode</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {relativeConfig?.postalCode ? `${sourcePath}.${relativeConfig.postalCode}` : 'Not mapped'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 italic">
                                            Sample: {getSampleForKey(relativeConfig?.postalCode) || '—'}
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-900">Country</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {relativeConfig?.countryCode ? `${sourcePath}.${relativeConfig.countryCode}` : 'Not mapped'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 italic">
                                            Sample: {getSampleForKey(relativeConfig?.countryCode) || '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-slate-400">Method:</span>{" "}
                                    <span className="font-semibold text-slate-700">
                                        {aiLoading ? "Analyzing..." : (aiResult ? "AI" : "Heuristic")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Confidence:</span>{" "}
                                    <span className={cn(
                                        "font-semibold",
                                        currentResult?.confidence === "HIGH" ? "text-green-600" :
                                        currentResult?.confidence === "MEDIUM" ? "text-amber-600" :
                                        "text-red-600"
                                    )}>
                                        {aiLoading ? "..." : currentResult?.confidence}
                                    </span>
                                </div>
                            </div>

                            {aiLoading ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                    <span className="text-xs text-slate-500">Running AI address analysis...</span>
                                </div>
                            ) : aiError ? (
                                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                                    <p className="font-semibold">AI Analysis failed:</p>
                                    <p>{aiError}</p>
                                    <p className="mt-1 text-slate-500">Falling back to Heuristic results.</p>
                                </div>
                            ) : null}

                            {!aiLoading && currentResult && (() => {
                                const detected = currentResult.detectedFields || {};
                                const addressLinesOk = Array.isArray(detected.addressLines) ? detected.addressLines.length > 0 : !!detected.addressLines;
                                
                                return (
                                    <div className="space-y-4">
                                        <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div className="font-semibold text-slate-700">Detected:</div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    {addressLinesOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">○</span>}
                                                    <span>Address lines</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    {detected.locality ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">○</span>}
                                                    <span>Locality</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    {detected.region ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">○</span>}
                                                    <span>Region</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    {detected.postalCode ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">○</span>}
                                                    <span>Postal code</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                                                    {detected.countryCode ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">○</span>}
                                                    <span>Country</span>
                                                </div>
                                            </div>
                                        </div>

                                        {!initialTargetFieldNo && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-700">What would you like to do?</label>
                                                <RadioGroup value={actionMode} onValueChange={(val: any) => setActionMode(val)} className="grid gap-2">
                                                    <div className="flex items-center space-x-2 rounded-md border border-slate-200 p-2 bg-white cursor-pointer hover:bg-slate-50">
                                                        <RadioGroupItem value="create" id="r-create" className="border-slate-300" />
                                                        <Label htmlFor="r-create" className="flex-1 text-xs cursor-pointer font-medium text-slate-700">
                                                            Create new Address field
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2 rounded-md border border-slate-200 p-2 bg-white cursor-pointer hover:bg-slate-50">
                                                        <RadioGroupItem value="map" id="r-map" className="border-slate-300" />
                                                        <Label htmlFor="r-map" className="flex-1 text-xs cursor-pointer font-medium text-slate-700">
                                                            Map to existing Address field
                                                        </Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                        )}

                                        {actionMode === "create" && (
                                            <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                <div className="grid gap-1">
                                                    <Label htmlFor="new-field-name" className="text-[11px] text-slate-500">Field Name</Label>
                                                    <Input
                                                        id="new-field-name"
                                                        value={newFieldName}
                                                        onChange={(e) => setNewFieldName(e.target.value)}
                                                        className="bg-white h-8 text-xs border-slate-200"
                                                        placeholder="e.g. Registered Address"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label htmlFor="new-field-category" className="text-[11px] text-slate-500">Category</Label>
                                                    <Input
                                                        id="new-field-category"
                                                        value={newFieldCategory}
                                                        disabled
                                                        className="bg-slate-100 h-8 text-xs text-slate-500 border-slate-200"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label htmlFor="new-field-desc" className="text-[11px] text-slate-500">Description (optional)</Label>
                                                    <Textarea
                                                        id="new-field-desc"
                                                        value={newFieldDescription}
                                                        onChange={(e) => setNewFieldDescription(e.target.value)}
                                                        className="bg-white text-xs min-h-[60px] border-slate-200"
                                                        placeholder="Describe what this address represents..."
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {actionMode === "map" && (() => {
                                            const addressFields = fieldDefinitions.filter(f => f.appDataType === 'ADDRESS');

                                            if (addressFields.length === 0) {
                                                return (
                                                    <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4">
                                                        No ADDRESS fields exist yet. Create an ADDRESS field first.
                                                    </div>
                                                );
                                            }

                                            const searchedCandidates = addressFields.filter(f => 
                                                f.fieldName.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
                                                (f.masterDataCategory?.displayName || "").toLowerCase().includes(fieldSearchTerm.toLowerCase())
                                            );

                                            return (
                                                <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-100 rounded-lg flex flex-col max-h-[260px]">
                                                    <div className="relative">
                                                        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                                                        <Input
                                                            value={fieldSearchTerm}
                                                            onChange={(e) => setFieldSearchTerm(e.target.value)}
                                                            placeholder="Search existing fields..."
                                                            className="pl-7 bg-white h-8 text-xs border-slate-200"
                                                        />
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto space-y-1 border border-slate-100 rounded bg-white p-1.5 custom-scrollbar min-h-[100px] max-h-[150px]">
                                                        {searchedCandidates.length === 0 ? (
                                                            <div className="text-[11px] text-slate-400 text-center py-4">
                                                                No fields match the search.
                                                            </div>
                                                        ) : (
                                                            searchedCandidates.map(field => {
                                                                const isSelected = selectedFieldNo === field.fieldNo;
                                                                return (
                                                                    <div
                                                                        key={field.fieldNo}
                                                                        onClick={() => setSelectedFieldNo(field.fieldNo)}
                                                                        className={cn(
                                                                            "flex items-center justify-between p-1.5 rounded cursor-pointer text-xs transition-colors",
                                                                            isSelected 
                                                                                ? "bg-indigo-50 border-indigo-200 border text-indigo-900 font-semibold"
                                                                                : "hover:bg-slate-50 text-slate-700 border border-transparent"
                                                                        )}
                                                                    >
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span>{field.fieldName}</span>
                                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                                {field.masterDataCategory?.displayName || "Uncategorized"} · {field.appDataType}
                                                                            </span>
                                                                        </div>
                                                                        {isSelected && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>

                <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
                    {isReviewingMapping ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => setIsReviewingMapping(false)} className="h-8 text-xs border-slate-200">Back</Button>
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold" onClick={async () => {
                                if (!currentResult || selectedFieldNo === null) return;
                                try {
                                    const res = await upsertSourceMapping({
                                        sourceType: sourceType as any,
                                        sourceReference: sourceReference || null,
                                        payloadSubtype: null,
                                        sourcePath: sourcePath,
                                        targetFieldNo: selectedFieldNo,
                                        transformType: 'TO_ADDRESS_VALUE',
                                        transformConfig: relativeConfig,
                                        priority: 100,
                                        mappingScope: 'BASELINE'
                                    });

                                    if (res.success) {
                                        toast.success("Address mapping saved as deterministic SourceFieldMapping.");
                                        onSaved?.();
                                        onOpenChange(false);
                                    } else {
                                        toast.error(res.error || "Failed to save mapping.");
                                    }
                                } catch (e: any) {
                                    toast.error(e.message || "An error occurred while saving the mapping.");
                                }
                            }}>Save Mapping</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs border-slate-200">Cancel</Button>
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold" onClick={() => {
                                if (actionMode === "create") {
                                    if (!newFieldName.trim()) {
                                        toast.error("Please enter a field name.");
                                        return;
                                    }
                                    onOpenChange(false);
                                    router.push(`/app/admin/master-data/manager?prefill=true&prefillType=ADDRESS&fieldName=${encodeURIComponent(newFieldName)}&categoryName=${encodeURIComponent(newFieldCategory)}&description=${encodeURIComponent(newFieldDescription)}`);
                                } else {
                                    if (selectedFieldNo === null) {
                                        toast.error("Please select a field to map to.");
                                        return;
                                    }
                                    setIsReviewingMapping(true);
                                }
                            }}>{actionMode === "create" ? "Continue" : "Review Mapping"}</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
