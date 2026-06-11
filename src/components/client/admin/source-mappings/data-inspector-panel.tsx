"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, PlusCircle, Globe, Tag, MapPin } from "lucide-react";
import { fetchLiveGleifRecord } from "@/actions/gleif-live";
import { fetchLiveRegistryRecord } from "@/actions/registry-live";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    detectAddressCandidate,
    isAddressLikePath,
    AddressDetectionResult,
    buildRelativeTransformConfig
} from "@/lib/address-detector";
import { upsertSourceMapping } from "@/actions/source-mappings";
import { detectAddressWithAI } from "@/actions/ai-address";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────

interface CrossFieldMapping {
    sourceType: string;
    sourceReference?: string | null;
    sourcePath: string;
    fieldNo: number;
    fieldName: string;
    isActive: boolean;
}

interface DataInspectorPanelProps {
    sourceType: string;
    /** mappingSourceKey (e.g. "COMPANIES_HOUSE", "RA000192"), or null for GLEIF.
     * fetchLiveRegistryRecord resolves this to the correct connector. */
    sourceReference?: string | null;
    /** Mappings belonging to the field currently being edited. */
    existingMappings: any[];
    /**
     * All active source mappings across ALL master fields (enriched with fieldNo + fieldName).
     * Used to show "mapped to Field N · Name" indicators for nodes claimed by other fields.
     */
    allSourceMappings?: CrossFieldMapping[];
    /** fieldNo of the field being edited — used to exclude its own mappings from the "other field" set. */
    currentFieldNo?: number;
    onSelectPath: (path: string) => void;
    readOnly?: boolean;
    title?: string;
    resolvedDefaults?: {
        gleifLei: string;
        chCompanyNo: string;
        frSiren: string;
    };
    fieldDefinitions?: any[];
}

// ── Component ──────────────────────────────────────────────────────────

export function DataInspectorPanel({ 
    sourceType, 
    sourceReference,
    existingMappings, 
    allSourceMappings = [],
    currentFieldNo,
    onSelectPath, 
    readOnly = false,
    title,
    resolvedDefaults,
    fieldDefinitions = []
}: DataInspectorPanelProps) {
    const router = useRouter();
    const isCompaniesHouse = sourceType === "REGISTRATION_AUTHORITY"
        && (sourceReference === "COMPANIES_HOUSE"
            || sourceReference === "RA000585"
            || sourceReference === "RA000586"
            || sourceReference === "RA000587");

    const defaultQuery = resolvedDefaults
        ? (sourceType === "GLEIF" ? resolvedDefaults.gleifLei
           : sourceReference === "RA000192" ? resolvedDefaults.frSiren
           : resolvedDefaults.chCompanyNo)
        : (sourceType === "GLEIF" ? "213800SN8QHYGA7QUF79"
           : sourceReference === "RA000192" ? "542051180"
           : "04155137"); // Default CH example

    const [query, setQuery] = useState(defaultQuery);
    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Helper to format address paths to prefilled field name
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

    const [activeAddressCandidate, setActiveAddressCandidate] = useState<{
        path: string;
        value: any;
        heuristicResult: AddressDetectionResult;
    } | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<AddressDetectionResult | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiCache] = useState<Map<string, AddressDetectionResult>>(new Map());

    // Phase 2 State
    const [actionMode, setActionMode] = useState<"create" | "map">("create");
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldCategory, setNewFieldCategory] = useState("Address Information");
    const [newFieldDescription, setNewFieldDescription] = useState("");
    const [selectedFieldNo, setSelectedFieldNo] = useState<number | null>(null);
    const [fieldSearchTerm, setFieldSearchTerm] = useState("");

    const handleMapAddress = async (path: string, value: any, heuristicResult: AddressDetectionResult) => {
        setAiResult(null);
        setAiError(null);
        setActiveAddressCandidate({ path, value, heuristicResult });
        
        // Prefill Phase 2 states
        setActionMode("create");
        setNewFieldName(formatFieldPrefillName(path));
        setNewFieldCategory("Address Information");
        setNewFieldDescription(`Imported address structure from source payload at ${path}.`);
        setSelectedFieldNo(null);
        setFieldSearchTerm("");

        // If score is borderline (3-7), lazily run AI detection
        if (heuristicResult.score >= 3 && heuristicResult.score <= 7) {
            const cacheKey = `${sourceType}:${sourceReference || "NONE"}:${path}:${JSON.stringify(value)}`;
            if (aiCache.has(cacheKey)) {
                setAiResult(aiCache.get(cacheKey) || null);
                return;
            }

            setAiLoading(true);
            try {
                const res = await detectAddressWithAI({
                    sourceType,
                    sourceReference,
                    nodePath: path,
                    nodeValue: value,
                    nearbyChildKeys: Object.keys(value)
                });
                if (res.success && res.result) {
                    setAiResult(res.result);
                    aiCache.set(cacheKey, res.result);
                } else {
                    setAiError(res.error || "Failed to analyze with AI");
                }
            } catch (e: any) {
                setAiError(e.message || "Failed to analyze with AI");
            } finally {
                setAiLoading(false);
            }
        }
    };

    useEffect(() => {
        setQuery(defaultQuery);
        if (defaultQuery && defaultQuery.trim().length >= 3) {
            setLoading(true);
            setError(null);
            const triggerFetch = async () => {
                try {
                    if (sourceType === "GLEIF") {
                        const res = await fetchLiveGleifRecord(defaultQuery);
                        if (res.success) setPayload(res.payload);
                        else { setError(res.error || "Failed to fetch data"); setPayload(null); }
                    } else if (sourceType === "REGISTRATION_AUTHORITY") {
                        const res = await fetchLiveRegistryRecord(defaultQuery, sourceReference || "COMPANIES_HOUSE");
                        if (res.success) setPayload(res.payload);
                        else { setError(res.error || "Failed to fetch registry data"); setPayload(null); }
                    }
                } catch (e) {
                    setError("An unexpected error occurred");
                } finally {
                    setLoading(false);
                }
            };
            triggerFetch();
        } else {
            setPayload(null);
        }
    }, [defaultQuery, sourceType, sourceReference]);

    // Fix 1: Only highlight paths that belong to THIS source (sourceType + sourceReference match).
    // Previously all mappings were included regardless of source, causing inconsistent
    // "Mapped" indicators across GLEIF vs Registry Browse views.
    const thisFieldPaths = new Set(
        existingMappings
            .filter(m =>
                m.isActive &&
                m.sourceType === sourceType &&
                (m.sourceReference ?? null) === (sourceReference ?? null)
            )
            .map(m => m.sourcePath)
    );

    // Build a map of path → { fieldNo, fieldName } for all OTHER fields' mappings
    // for the same source type. This powers the amber "Field N · Name" indicator.
    const otherFieldPathMap = new Map<string, { fieldNo: number; fieldName: string }>();
    for (const m of allSourceMappings) {
        if (!m.isActive) continue;
        if (m.sourceType !== sourceType) continue;
        // Skip mappings that belong to the field we're currently editing
        if (currentFieldNo !== undefined && m.fieldNo === currentFieldNo) continue;
        // Use the first mapping found for a given path (lowest fieldNo wins for display)
        if (!otherFieldPathMap.has(m.sourcePath)) {
            otherFieldPathMap.set(m.sourcePath, { fieldNo: m.fieldNo, fieldName: m.fieldName });
        }
    }

    const handleSearch = async () => {
        if (!query.trim() || query.length < 3) return;
        setLoading(true);
        setError(null);
        try {
            if (sourceType === "GLEIF") {
                const res = await fetchLiveGleifRecord(query);
                if (res.success) setPayload(res.payload);
                else { setError(res.error || "Failed to fetch data"); setPayload(null); }
            } else if (sourceType === "REGISTRATION_AUTHORITY") {
                // Pass sourceReference (mappingSourceKey or RA code).
                // fetchLiveRegistryRecord resolves COMPANIES_HOUSE → RA000585 for connector routing.
                const res = await fetchLiveRegistryRecord(query, sourceReference || "COMPANIES_HOUSE");
                if (res.success) setPayload(res.payload);
                else { setError(res.error || "Failed to fetch registry data"); setPayload(null); }
            } else {
                setError(`Live fetch not yet implemented for ${sourceType}`);
                setPayload(null);
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const searchPlaceholder =
        sourceType === "GLEIF"
            ? "Enter LEI or Company Name..."
            : sourceReference === "RA000192"
            ? "Enter SIREN (9 digits, e.g. 542051180)..."
            : "Enter Company Number (e.g. 07640868)...";

    return (
        <Card className="flex flex-col h-[calc(100vh-12rem)] sticky top-6">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base text-slate-800">
                        {title || (sourceType === "GLEIF" ? "GLEIF Data Inspector" : "Live Data Inspector")}
                    </CardTitle>
                </div>
                <CardDescription className="text-xs">
                    {sourceType === "GLEIF" 
                        ? 'Search real LEI data to explore the schema.' 
                        : 'Search real registry data to explore the schema.'}
                </CardDescription>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> This field
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Another field
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" /> Unmapped
                    </span>
                </div>
                
                <div className="flex gap-2 mt-3 pt-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder={searchPlaceholder}
                            className="pl-9 h-9 text-sm"
                            disabled={loading}
                        />
                    </div>
                    <Button size="sm" className="h-9 shrink-0" onClick={handleSearch} disabled={loading || query.length < 3}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                    </Button>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col bg-slate-50">
                {error && (
                    <div className="p-4 m-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                        {error}
                    </div>
                )}
                
                {!payload && !error && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                        <Search className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm">Search to explore live API schema.<br/>Click ⊕ next to any field to instantly map it.</p>
                    </div>
                )}
                
                {loading && !payload && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                )}

                {payload && (
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        <JsonTree 
                            data={payload} 
                            thisFieldPaths={thisFieldPaths}
                            otherFieldPathMap={otherFieldPathMap}
                            onSelect={onSelectPath} 
                            readOnly={readOnly}
                            onMapAddress={handleMapAddress}
                        />
                    </div>
                )}
            </CardContent>

            {/* Address Detection Dialog */}
            <Dialog open={activeAddressCandidate !== null} onOpenChange={(open) => { if (!open) setActiveAddressCandidate(null); }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <MapPin className="h-5 w-5 text-indigo-500" />
                            Address detected
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 dark:text-slate-400">
                            We think this source object represents an address structure.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Dialog Content body */}
                    <div className="space-y-4 py-1 flex-1">
                        {/* Detection Info */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                            <div>
                                <span className="text-slate-400">Method:</span>{" "}
                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                    {aiLoading ? "Analyzing..." : (aiResult ? "AI" : "Heuristic")}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400">Confidence:</span>{" "}
                                <span className={cn(
                                    "font-semibold",
                                    (aiResult || activeAddressCandidate?.heuristicResult)?.confidence === "HIGH" ? "text-green-600" :
                                    (aiResult || activeAddressCandidate?.heuristicResult)?.confidence === "MEDIUM" ? "text-amber-600" :
                                    "text-red-600"
                                )}>
                                    {aiLoading ? "..." : (aiResult || activeAddressCandidate?.heuristicResult)?.confidence}
                                </span>
                            </div>
                        </div>

                        {/* Loading / Error */}
                        {aiLoading ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                <span className="text-xs text-slate-500">Running AI address analysis...</span>
                            </div>
                        ) : aiError ? (
                            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-955/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">
                                <p className="font-semibold">AI Analysis failed:</p>
                                <p>{aiError}</p>
                                <p className="mt-1 text-slate-500">Falling back to Heuristic results.</p>
                            </div>
                        ) : null}

                        {/* Display resolved checkmarks if not loading */}
                        {!aiLoading && (() => {
                            const currentResult = aiResult || activeAddressCandidate?.heuristicResult;
                            if (!currentResult) return null;

                            const detected = currentResult.detectedFields || {};
                            const addressLinesOk = Array.isArray(detected.addressLines) ? detected.addressLines.length > 0 : !!detected.addressLines;
                            const localityOk = !!detected.locality;
                            const regionOk = !!detected.region;
                            const postalCodeOk = !!detected.postalCode;
                            const countryOk = !!detected.countryCode;

                            return (
                                <div className="space-y-4">
                                    {/* Detected Fields checklist */}
                                    <div className="text-xs space-y-1.5 bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
                                        <div className="font-semibold text-slate-700 dark:text-zinc-300">Detected:</div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                                                {addressLinesOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300 dark:text-zinc-700">○</span>}
                                                <span>Address lines</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                                                {localityOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300 dark:text-zinc-700">○</span>}
                                                <span>Locality</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                                                {regionOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300 dark:text-zinc-700">○</span>}
                                                <span>Region</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                                                {postalCodeOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300 dark:text-zinc-700">○</span>}
                                                <span>Postal code</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 col-span-2">
                                                {countryOk ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300 dark:text-zinc-700">○</span>}
                                                <span>Country</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Mode selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">What would you like to do?</label>
                                        <RadioGroup value={actionMode} onValueChange={(val: any) => setActionMode(val)} className="grid gap-2">
                                            <div className="flex items-center space-x-2 rounded-md border border-slate-200 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                                                <RadioGroupItem value="create" id="r-create" className="border-slate-300 dark:border-zinc-700" />
                                                <Label htmlFor="r-create" className="flex-1 text-xs cursor-pointer font-medium text-slate-700 dark:text-zinc-200">
                                                    Create new Address field
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2 rounded-md border border-slate-200 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                                                <RadioGroupItem value="map" id="r-map" className="border-slate-300 dark:border-zinc-700" />
                                                <Label htmlFor="r-map" className="flex-1 text-xs cursor-pointer font-medium text-slate-700 dark:text-zinc-200">
                                                    Map to existing Address field
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {/* Mode-specific content */}
                                    {actionMode === "create" && (
                                        <div className="space-y-3 p-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-lg">
                                            <div className="grid gap-1">
                                                <Label htmlFor="new-field-name" className="text-[11px] text-slate-500 dark:text-zinc-400">Field Name</Label>
                                                <Input
                                                    id="new-field-name"
                                                    value={newFieldName}
                                                    onChange={(e) => setNewFieldName(e.target.value)}
                                                    className="bg-white dark:bg-zinc-900 h-8 text-xs border-slate-200 dark:border-zinc-800"
                                                    placeholder="e.g. Registered Address"
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="new-field-category" className="text-[11px] text-slate-500 dark:text-zinc-400">Category</Label>
                                                <Input
                                                    id="new-field-category"
                                                    value={newFieldCategory}
                                                    disabled
                                                    className="bg-slate-100 dark:bg-zinc-800/50 h-8 text-xs text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800"
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label htmlFor="new-field-desc" className="text-[11px] text-slate-500 dark:text-zinc-400">Description (optional)</Label>
                                                <Textarea
                                                    id="new-field-desc"
                                                    value={newFieldDescription}
                                                    onChange={(e) => setNewFieldDescription(e.target.value)}
                                                    className="bg-white dark:bg-zinc-900 text-xs min-h-[60px] border-slate-200 dark:border-zinc-800"
                                                    placeholder="Describe what this address represents..."
                                                />
                                            </div>
                                            <div className="text-[10px] text-indigo-700 bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-100 dark:border-indigo-900/50 rounded-md p-2 mt-1 leading-normal font-sans">
                                                Note: This field uses a <strong>TEXT</strong> placeholder in preparation for the future <strong>ADDRESS</strong> datatype.
                                            </div>
                                        </div>
                                    )}

                                    {actionMode === "map" && (() => {
                                        const addressFields = fieldDefinitions.filter(f => f.appDataType === 'ADDRESS');

                                        if (addressFields.length === 0) {
                                            return (
                                                <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-200 dark:border-zinc-800 rounded-lg p-4">
                                                    No ADDRESS fields exist yet. Create an ADDRESS field first.
                                                </div>
                                            );
                                        }

                                        // Apply search filter
                                        const searchedCandidates = addressFields.filter(f => 
                                            f.fieldName.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
                                            (f.masterDataCategory?.displayName || "").toLowerCase().includes(fieldSearchTerm.toLowerCase())
                                        );

                                        return (
                                            <div className="space-y-2.5 p-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-lg flex flex-col max-h-[260px]">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                                                    <Input
                                                        value={fieldSearchTerm}
                                                        onChange={(e) => setFieldSearchTerm(e.target.value)}
                                                        placeholder="Search existing fields..."
                                                        className="pl-7 bg-white dark:bg-zinc-900 h-8 text-xs border-slate-200 dark:border-zinc-800"
                                                    />
                                                </div>

                                                <div className="flex-1 overflow-y-auto space-y-1 border border-slate-100 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 p-1.5 custom-scrollbar min-h-[100px] max-h-[150px]">
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
                                                                            ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-955/20 border text-indigo-900 dark:text-indigo-200 font-semibold"
                                                                            : "hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 border border-transparent"
                                                                    )}
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span>{field.fieldName}</span>
                                                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
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
                    </div>

                    <DialogFooter className="border-t border-slate-100 dark:border-zinc-800 pt-3 flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActiveAddressCandidate(null)} className="h-8 text-xs border-slate-200 dark:border-zinc-850">
                            Cancel
                        </Button>
                        <Button 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs" 
                            onClick={async () => {
                                if (!activeAddressCandidate) return;
                                if (actionMode === "create") {
                                    if (!newFieldName.trim()) {
                                        toast.error("Please enter a field name.");
                                        return;
                                    }
                                    setActiveAddressCandidate(null);
                                    router.push(`/app/admin/master-data/manager?prefill=true&prefillType=ADDRESS&fieldName=${encodeURIComponent(newFieldName)}&categoryName=${encodeURIComponent(newFieldCategory)}&description=${encodeURIComponent(newFieldDescription)}`);
                                } else {
                                    if (selectedFieldNo === null) {
                                        toast.error("Please select a field to map to.");
                                        return;
                                    }
                                    const match = fieldDefinitions.find(f => f.fieldNo === selectedFieldNo);
                                    if (!match || match.appDataType !== 'ADDRESS') {
                                        toast.error("Selected field is not an ADDRESS field.");
                                        return;
                                    }

                                    const relativeConfig = buildRelativeTransformConfig(
                                        activeAddressCandidate.value,
                                        activeAddressCandidate.heuristicResult.detectedFields
                                    );

                                    try {
                                        const res = await upsertSourceMapping({
                                            sourceType: sourceType as any,
                                            sourceReference: sourceReference || null,
                                            payloadSubtype: null,
                                            sourcePath: activeAddressCandidate.path,
                                            targetFieldNo: selectedFieldNo,
                                            transformType: 'TO_ADDRESS_VALUE',
                                            transformConfig: relativeConfig,
                                            priority: 100,
                                            mappingScope: 'BASELINE'
                                        });

                                        if (res.success) {
                                            toast.success("Address mapping saved as deterministic SourceFieldMapping.");
                                            setActiveAddressCandidate(null);
                                            router.refresh();
                                        } else {
                                            toast.error(res.error || "Failed to save mapping.");
                                        }
                                    } catch (e: any) {
                                        toast.error(e.message || "An error occurred while saving the mapping.");
                                    }
                                }
                            }}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ── Recursive JSON Tree ────────────────────────────────────────────────

function JsonTree({ 
    data, 
    path = "", 
    thisFieldPaths,
    otherFieldPathMap,
    onSelect,
    readOnly = false,
    onMapAddress
}: { 
    data: any,
    path?: string,
    thisFieldPaths: Set<string>,
    otherFieldPathMap: Map<string, { fieldNo: number; fieldName: string }>,
    onSelect: (path: string) => void,
    readOnly?: boolean,
    onMapAddress?: (path: string, value: any, heuristicResult: AddressDetectionResult) => void
}) {
    if (data === null) {
        return <span className="text-slate-400 font-mono text-xs">null</span>;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return <span className="text-slate-400 font-mono text-xs">[]</span>;
        
        return (
            <div className="pl-4 border-l border-slate-200 ml-1 mt-1 space-y-1">
                {data.map((item, index) => (
                    <div key={index} className="flex gap-2">
                        <span className="text-slate-400 text-xs shrink-0 font-mono">[{index}]</span>
                        <div className="flex-1">
                            {typeof item === 'object' && item !== null ? (
                                <JsonTree 
                                    data={item} 
                                    path={`${path}[${index}]`}
                                    thisFieldPaths={thisFieldPaths}
                                    otherFieldPathMap={otherFieldPathMap}
                                    onSelect={onSelect} 
                                    readOnly={readOnly}
                                    onMapAddress={onMapAddress}
                                />
                            ) : (
                                <ValueNode 
                                    value={item} 
                                    itemPath={`${path}[${index}]`}
                                    isMappedHere={thisFieldPaths.has(`${path}[${index}]`)}
                                    otherFieldMapping={otherFieldPathMap.get(`${path}[${index}]`) ?? null}
                                    onSelect={onSelect} 
                                    readOnly={readOnly}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return <span className="text-slate-400 font-mono text-xs">{}</span>;

        return (
            <div className="space-y-0.5">
                {keys.map(key => {
                    const value = data[key];
                    const childPath = path ? `${path}.${key}` : key;
                    const isObject = typeof value === 'object' && value !== null;
                    const isMappedHere = thisFieldPaths.has(childPath);
                    const otherFieldMapping = otherFieldPathMap.get(childPath) ?? null;
                    
                    return (
                        <ObjectRow
                            key={key}
                            keyName={key}
                            value={value}
                            childPath={childPath}
                            isObject={isObject}
                            isMappedHere={isMappedHere}
                            otherFieldMapping={otherFieldMapping}
                            thisFieldPaths={thisFieldPaths}
                            otherFieldPathMap={otherFieldPathMap}
                            onSelect={onSelect}
                            readOnly={readOnly}
                            onMapAddress={onMapAddress}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <ValueNode
            value={data}
            itemPath={path}
            isMappedHere={thisFieldPaths.has(path)}
            otherFieldMapping={otherFieldPathMap.get(path) ?? null}
            onSelect={onSelect}
            readOnly={readOnly}
        />
    );
}

// ── ObjectRow ──────────────────────────────────────────────────────────

// Fix 2: Extracted row into its own component with local hover state.
function ObjectRow({
    keyName,
    value,
    childPath,
    isObject,
    isMappedHere,
    otherFieldMapping,
    thisFieldPaths,
    otherFieldPathMap,
    onSelect,
    readOnly,
    onMapAddress,
}: {
    keyName: string;
    value: any;
    childPath: string;
    isObject: boolean;
    isMappedHere: boolean;
    otherFieldMapping: { fieldNo: number; fieldName: string } | null;
    thisFieldPaths: Set<string>;
    otherFieldPathMap: Map<string, { fieldNo: number; fieldName: string }>;
    onSelect: (path: string) => void;
    readOnly: boolean;
    onMapAddress?: (path: string, value: any, heuristicResult: AddressDetectionResult) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const detection = isObject ? detectAddressCandidate(childPath, value) : null;
    const showMapAddressBtn = isObject && !readOnly && detection && (
        detection.score >= 8 ||
        (detection.score >= 3 && detection.score <= 7 && isAddressLikePath(childPath))
    );

    return (
        <div
            className={cn(
                "relative rounded transition-all duration-75",
                // Persistent left border for mapped nodes
                isMappedHere && "border-l-2 border-green-400 pl-1",
                otherFieldMapping && !isMappedHere && "border-l-2 border-amber-300 pl-1",
                // Hover (unmapped): stronger blue border + visible background
                isHovered && !isMappedHere && !otherFieldMapping && "border-l-2 border-blue-500 pl-1 bg-blue-100/60",
                // Hover on already-annotated nodes: brighten their bg
                isHovered && isMappedHere && "bg-green-50/50",
                isHovered && otherFieldMapping && !isMappedHere && "bg-amber-50/50",
                // Default: reserve border space so rows don't jump
                !isMappedHere && !otherFieldMapping && "border-l-2 border-transparent pl-1"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Key Row */}
            <div className="flex items-center py-0.5 px-1 -ml-1">
                <span className={cn(
                    "font-mono text-[11px] font-semibold transition-all",
                    isMappedHere
                        ? "text-green-600"
                        : otherFieldMapping
                        ? "text-amber-600"
                        : isHovered
                        // Highlighted pill behind the key name — visible anchor for the eye
                        // even when focus is on the far-right Add button
                        ? "text-blue-800 bg-blue-200/70 rounded px-1 -mx-1"
                        : "text-indigo-900"
                )}>
                    {keyName}:
                </span>

                {/* Inline primitive value */}
                {!isObject && (
                    <div className="ml-2 flex-1 flex items-center justify-between min-w-0">
                        <ValueNode 
                            value={value} 
                            itemPath={childPath}
                            isMappedHere={isMappedHere}
                            otherFieldMapping={otherFieldMapping}
                            onSelect={onSelect} 
                            readOnly={readOnly}
                            isRowHovered={isHovered}
                        />
                    </div>
                )}

                {/* Object/array level badge */}
                {isObject && !readOnly && (
                    <div className="ml-auto pl-2 shrink-0 flex items-center gap-1.5">
                        {isMappedHere ? (
                            <ThisFieldBadge />
                        ) : otherFieldMapping ? (
                            <div className="flex items-center gap-1.5">
                                <OtherFieldBadge fieldNo={otherFieldMapping.fieldNo} fieldName={otherFieldMapping.fieldName} />
                                {showMapAddressBtn && detection && (
                                    <MapAddressButton onClick={() => onMapAddress?.(childPath, value, detection)} visible={isHovered} />
                                )}
                                <MappingButton onClick={() => onSelect(childPath)} visible={isHovered} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                {showMapAddressBtn && detection && (
                                    <MapAddressButton onClick={() => onMapAddress?.(childPath, value, detection)} visible={isHovered} />
                                )}
                                <MappingButton onClick={() => onSelect(childPath)} visible={isHovered} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recursive body */}
            {isObject && (
                <div className="pl-4 ml-1.5 border-l border-slate-200 mt-0.5">
                    <JsonTree 
                        data={value} 
                        path={childPath}
                        thisFieldPaths={thisFieldPaths}
                        otherFieldPathMap={otherFieldPathMap}
                        onSelect={onSelect} 
                        readOnly={readOnly}
                        onMapAddress={onMapAddress}
                    />
                </div>
            )}
        </div>
    );
}

// ── ValueNode (Leaf) ───────────────────────────────────────────────────

function ValueNode({ 
    value, 
    itemPath, 
    isMappedHere,
    otherFieldMapping,
    onSelect,
    readOnly = false,
    isRowHovered = false,
}: { 
    value: any,
    itemPath: string,
    isMappedHere: boolean,
    otherFieldMapping: { fieldNo: number; fieldName: string } | null,
    onSelect: (path: string) => void,
    readOnly?: boolean,
    isRowHovered?: boolean,
}) {
    let displayValueType = "text-slate-600";
    if (typeof value === "string") displayValueType = "text-emerald-600";
    else if (typeof value === "number") displayValueType = "text-orange-600";
    else if (typeof value === "boolean") displayValueType = "text-blue-600";

    const displayStr = typeof value === "string" ? `"${value}"` : String(value);

    return (
        <div className="flex items-center justify-between w-full gap-2">
            <span
                className={cn("font-mono text-[11px] truncate max-w-[200px] xl:max-w-[280px]", displayValueType)}
                title={displayStr}
            >
                {displayStr}
            </span>
            
            <div className="flex items-center gap-1 shrink-0">
                {isMappedHere ? (
                    <ThisFieldBadge />
                ) : (
                    <>
                        {otherFieldMapping && (
                            <OtherFieldBadge
                                fieldNo={otherFieldMapping.fieldNo}
                                fieldName={otherFieldMapping.fieldName}
                            />
                        )}
                        {!readOnly && (
                            <MappingButton onClick={() => onSelect(itemPath)} visible={isRowHovered} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Badge / Button Sub-components ──────────────────────────────────────

/** Green badge: this node is mapped to the field currently being edited. */
function ThisFieldBadge() {
    return (
        <div className="text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold tracking-wider">
            <Check className="h-2.5 w-2.5" /> THIS FIELD
        </div>
    );
}

/** Amber badge: this node is mapped to a different master field. */
function OtherFieldBadge({ fieldNo, fieldName }: { fieldNo: number; fieldName: string }) {
    return (
        <div
            className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-medium max-w-[120px] truncate"
            title={`Field ${fieldNo} · ${fieldName}`}
        >
            <Tag className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">F{fieldNo} · {fieldName}</span>
        </div>
    );
}

// Fix 2: Button is always rendered but visually prominent only when the row is hovered.
function MappingButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
    return (
        <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={cn(
                "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all border shadow-sm",
                visible
                    ? "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200 opacity-100"
                    : "text-slate-400 bg-slate-50 border-slate-200 opacity-40 hover:opacity-80"
            )}
        >
            <PlusCircle className="h-3 w-3" />
            Add
        </button>
    );
}

function MapAddressButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
    return (
        <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={cn(
                "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all border shadow-sm",
                visible
                    ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 opacity-100"
                    : "text-slate-400 bg-slate-50 border-slate-200 opacity-40 hover:opacity-80"
            )}
        >
            <MapPin className="h-3 w-3 text-indigo-500" />
            Map Address?
        </button>
    );
}
