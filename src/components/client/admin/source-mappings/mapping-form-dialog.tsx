import { useState, useEffect, useMemo } from "react";
import { Loader2, ChevronsUpDown, Check, Search, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { upsertSourceMapping } from "@/actions/source-mappings";
import { type SourceOption } from "@/lib/source-display";
import { TRANSFORM_SELECT_OPTIONS, getTransformDescription } from "@/lib/master-data/transform-registry";
import { getCountryName } from "@/components/client/fields/AddressValueViewer";
import { resolvePathString } from "@/services/kyc/normalization/pathResolver";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MappingRow {
    id: string;
    sourcePath: string;
    transformConfig?: any;
    targetFieldNo: number;
    mappingScope: string;
    payloadSubtype: string | null;
    transformType: string;
    priority: number;
    isActive: boolean;
    notes: string | null;
    sourceType: string;
    sourceReference: string | null;
    targetField?: {
        fieldNo: number;
        fieldName: string;
        appDataType: string;
        isActive: boolean;
    } | null;
}

const SCOPE_LABELS: Record<string, string> = {
    RAW_PAYLOAD: "Raw Payload",
    BASELINE:    "Baseline",
};

export function displayScope(rawScope: string, sourceType: string): string {
    if (sourceType === "GLEIF") return "GLEIF_DIRECT";
    return SCOPE_LABELS[rawScope] ?? rawScope;
}

const GLEIF_SCOPE_DEFAULT    = "BASELINE";
const RA_SCOPE_DEFAULT       = "RAW_PAYLOAD";
const RA_SUBTYPE_DEFAULT     = "COMPANY_PROFILE";

function AddressMappingEditor({ config, onChangeConfig, mappingRootPath, samplePayload }: { config: any, onChangeConfig: (c: any) => void, mappingRootPath: string, samplePayload: any }) {
    const [rawOpen, setRawOpen] = useState(false);
    
    const addressLines: string[] = Array.isArray(config?.addressLines) ? config.addressLines : [];
    const locality = config?.locality || "";
    const region = config?.region || "";
    const postalCode = config?.postalCode || "";
    const countryCode = config?.countryCode || "";

    const rawSourceNodeText = useMemo(() => {
        if (!samplePayload || !mappingRootPath) {
            return "No sample data loaded";
        }
        const rootValue = resolvePathString(samplePayload, mappingRootPath);
        if (rootValue === null || rootValue === undefined) {
            return `No node found at path: ${mappingRootPath}`;
        }
        return JSON.stringify(rootValue, null, 2);
    }, [samplePayload, mappingRootPath]);

    const updateField = (field: string, value: any) => {
        const newConfig = { ...(config || {}) };
        if (!value || (Array.isArray(value) && value.length === 0)) {
            delete newConfig[field];
        } else {
            newConfig[field] = value;
        }
        onChangeConfig(newConfig);
    };

    const handleUpdateLine = (index: number, value: string) => {
        const newLines = [...addressLines];
        newLines[index] = value;
        updateField("addressLines", newLines);
    };

    const handleRemoveLine = (index: number) => {
        const newLines = [...addressLines];
        newLines.splice(index, 1);
        updateField("addressLines", newLines);
    };

    const handleAddLine = () => {
        updateField("addressLines", [...addressLines, ""]);
    };

    return (
        <div className="grid gap-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <button
                    type="button"
                    onClick={() => setRawOpen(!rawOpen)}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                >
                    <span>Source Field (Payload)</span>
                    <span className="text-[10px] lowercase font-normal text-slate-400">({rawOpen ? "hide raw payload" : "show raw payload"})</span>
                </button>
            </div>

            {rawOpen && (
                <div className="grid gap-1 bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                    <pre className="font-mono text-[10px] text-slate-600 dark:text-zinc-400 overflow-auto max-h-[120px] whitespace-pre-wrap">
                        {rawSourceNodeText}
                    </pre>
                </div>
            )}

            <div className="space-y-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-lg p-3">
                <div className="grid gap-2">
                    <Label className="text-xs">Address Lines (ordered list of source paths)</Label>
                    <div className="space-y-2">
                        {addressLines.map((path, idx) => (
                            <div key={`line-${idx}`} className="flex items-center gap-2">
                                <Input 
                                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-950" 
                                    placeholder="e.g. premises or address_line_1"
                                    value={path}
                                    onChange={(e) => handleUpdateLine(idx, e.target.value)}
                                />
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-500 bg-white dark:bg-zinc-950" 
                                    onClick={() => handleRemoveLine(idx)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] w-fit mt-1 bg-white dark:bg-zinc-950" onClick={handleAddLine}>
                        + Add Line
                    </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Locality (City)</Label>
                        <Input 
                            className="h-8 text-xs font-mono bg-white dark:bg-zinc-950" 
                            placeholder="e.g. locality" 
                            value={locality} 
                            onChange={(e) => updateField("locality", e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Region</Label>
                        <Input 
                            className="h-8 text-xs font-mono bg-white dark:bg-zinc-950" 
                            placeholder="e.g. region" 
                            value={region} 
                            onChange={(e) => updateField("region", e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Postal Code</Label>
                        <Input 
                            className="h-8 text-xs font-mono bg-white dark:bg-zinc-950" 
                            placeholder="e.g. postal_code" 
                            value={postalCode} 
                            onChange={(e) => updateField("postalCode", e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Country Code</Label>
                        <Input 
                            className="h-8 text-xs font-mono bg-white dark:bg-zinc-950" 
                            placeholder="e.g. country" 
                            value={countryCode} 
                            onChange={(e) => updateField("countryCode", e.target.value)} 
                        />
                    </div>
                </div>
            </div>
            
            <div className="grid gap-1.5 mt-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">transformConfig JSON Preview</Label>
                <div className="bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                    <pre className="font-mono text-[10px] text-slate-600 dark:text-zinc-400 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(config || {}, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

function AddressPostalPreview({ value }: { value: any }) {
    if (!value) return null;
    const lines = value.addressLines || [];
    const postcode = value.postalCode || "";
    const locality = value.locality || "";
    const country = getCountryName(value.countryCode) || value.countryCode || "";

    return (
        <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-zinc-300">
            {lines.map((line: string, idx: number) => (
                <div key={idx}>{line}</div>
            ))}
            {(postcode || locality) && (
                <div>{`${postcode} ${locality}`.trim()}</div>
            )}
            {country && <div>{country}</div>}
        </div>
    );
}

export function MappingFormDialog({ open, onOpenChange, selectedOption, fieldDefs, existingMapping, initialSourcePath, initialPayloadSubtype, initialTransformType, initialTransformConfig, onSaved, resolvedDefaults }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    selectedOption: SourceOption;
    fieldDefs: any[];
    existingMapping: MappingRow | null;
    initialSourcePath: string;
    initialPayloadSubtype?: string | null;
    initialTransformType?: string | null;
    initialTransformConfig?: any;
    onSaved: () => void;
    resolvedDefaults?: any;
}) {
    const isGleif  = selectedOption.sourceType === "GLEIF";
    const isEdit   = !!existingMapping;

    const [sourcePath,    setSourcePath]    = useState("");
    const [targetFieldNo, setTargetFieldNo] = useState("");
    const [mappingScope,  setMappingScope]  = useState(isGleif ? GLEIF_SCOPE_DEFAULT : RA_SCOPE_DEFAULT);
    const [payloadSubtype,setPayloadSubtype]= useState(isGleif ? "LEVEL_1" : RA_SUBTYPE_DEFAULT);
    const [transformType, setTransformType] = useState("DIRECT");
    const [priority,      setPriority]      = useState("100");
    const [notes,         setNotes]         = useState("");
    const [saving,        setSaving]        = useState(false);

    // Collapsible / Advanced Settings State
    const [advancedOpen,  setAdvancedOpen]  = useState(false);

    // Live preview sample states
    const [transformConfig, setTransformConfig] = useState<any>(null);
    const [samplePayload, setSamplePayload] = useState<any>(null);
    const [loadingSample, setLoadingSample] = useState(false);

    const targetField = useMemo(() => {
        return fieldDefs.find((f: any) => String(f.fieldNo) === targetFieldNo);
    }, [fieldDefs, targetFieldNo]);

    const isAddressMapping = useMemo(() => {
        return transformType === "TO_ADDRESS_VALUE" || targetField?.appDataType === "ADDRESS";
    }, [transformType, targetField]);

    const isPersonOrContactMapping = useMemo(() => {
        return transformType === "TO_PARTY_VALUE_LIST" ||
               transformType === "TO_PARTY_VALUE" ||
               transformType === "TO_PERSON_OR_CONTACT_LIST" || 
               transformType === "TO_PERSON_OR_CONTACT_VALUE" || 
               targetField?.appDataType === "PARTY" ||
               targetField?.appDataType === "PERSON_OR_CONTACT";
    }, [transformType, targetField]);

    const transformDescription = getTransformDescription(transformType);

    useEffect(() => {
        if (!open) return;
        setSourcePath(existingMapping?.sourcePath ?? initialSourcePath ?? "");
        setTargetFieldNo(existingMapping?.targetFieldNo?.toString() ?? "");
        setMappingScope(existingMapping?.mappingScope ?? (isGleif ? GLEIF_SCOPE_DEFAULT : RA_SCOPE_DEFAULT));

        const targetFieldId = existingMapping?.targetFieldNo?.toString() ?? "";
        const field = fieldDefs.find((f: any) => String(f.fieldNo) === targetFieldId);
        const defaultSubtype = isGleif ? "LEVEL_1" : ((field?.appDataType === "PARTY" || field?.appDataType === "PERSON_OR_CONTACT") ? "OFFICERS" : RA_SUBTYPE_DEFAULT);
        setPayloadSubtype(existingMapping?.payloadSubtype ?? initialPayloadSubtype ?? defaultSubtype);

        setTransformType(existingMapping?.transformType ?? initialTransformType ?? "DIRECT");
        setPriority(existingMapping?.priority?.toString() ?? "100");
        setNotes(existingMapping?.notes ?? "");
        setTransformConfig(existingMapping?.transformConfig ?? initialTransformConfig ?? null);
        setAdvancedOpen(false);
    }, [open, existingMapping, initialSourcePath, initialPayloadSubtype, initialTransformType, initialTransformConfig, isGleif, fieldDefs]);

    // Load sample payload for preview
    useEffect(() => {
        if (!open || !isAddressMapping) {
            setSamplePayload(null);
            return;
        }

        const fetchSample = async () => {
            setLoadingSample(true);
            try {
                const query = selectedOption.sourceType === "GLEIF"
                    ? (resolvedDefaults?.gleifLei || "213800SN8QHYGA7QUF79")
                    : selectedOption.sourceReference === "RA000192"
                    ? (resolvedDefaults?.frSiren || "542051180")
                    : (resolvedDefaults?.chCompanyNo || "14059418");

                if (selectedOption.sourceType === "GLEIF") {
                    const { fetchLiveGleifRecord } = await import("@/actions/gleif-live");
                    const res = await fetchLiveGleifRecord(query);
                    if (res.success) setSamplePayload(res.payload);
                } else if (selectedOption.sourceType === "REGISTRATION_AUTHORITY") {
                    const { fetchLiveRegistryRecord } = await import("@/actions/registry-live");
                    const res = await fetchLiveRegistryRecord(query, selectedOption.sourceReference || "COMPANIES_HOUSE");
                    if (res.success) setSamplePayload(res.payload);
                }
            } catch (err) {
                console.error("Failed to load preview sample:", err);
            } finally {
                setLoadingSample(false);
            }
        };

        fetchSample();
    }, [open, isAddressMapping, selectedOption, resolvedDefaults]);

    const previewAddress = useMemo(() => {
        const config = transformConfig || {};

        // 1. Try to resolve using samplePayload if available
        if (samplePayload && sourcePath) {
            const rootValue = resolvePathString(samplePayload, sourcePath);
            if (rootValue && typeof rootValue === "object") {
                const resolveRelative = (relPath: string | undefined): string | null => {
                    if (!relPath) return null;
                    return resolvePathString(rootValue, relPath);
                };

                const linesPaths: string[] = Array.isArray(config.addressLines) ? config.addressLines : [];
                const addressLines: string[] = [];
                for (const p of linesPaths) {
                    const val = resolvePathString(rootValue, p);
                    if (Array.isArray(val)) {
                        addressLines.push(...val.map(String));
                    } else if (val != null) {
                        addressLines.push(String(val));
                    }
                }

                const resolved = {
                    addressLines,
                    locality: resolveRelative(config.locality),
                    region: resolveRelative(config.region),
                    postalCode: resolveRelative(config.postalCode),
                    countryCode: resolveRelative(config.countryCode),
                };

                // Check if any field is populated
                if (resolved.addressLines.length > 0 || resolved.locality || resolved.region || resolved.postalCode || resolved.countryCode) {
                    return resolved;
                }
            }
        }

        // 2. Otherwise derive from the current mapping config where possible
        const cleanVal = (val: any) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.map(v => v.split('.').pop() || v);
            return val.split('.').pop() || val;
        };

        const lines = cleanVal(config.addressLines);
        return {
            addressLines: Array.isArray(lines) ? lines : (lines ? [lines] : ["addressLines"]),
            locality: cleanVal(config.locality) || "locality",
            region: cleanVal(config.region) || "region",
            postalCode: cleanVal(config.postalCode) || "postalCode",
            countryCode: cleanVal(config.countryCode) || "countryCode",
        };
    }, [samplePayload, sourcePath, transformConfig]);



    const handleSave = async () => {
        if (!sourcePath.trim() || !targetFieldNo) return;
        setSaving(true);
        const res = await upsertSourceMapping({
            id:             existingMapping?.id,
            sourceType:     selectedOption.sourceType as any,
            sourceReference:selectedOption.sourceReference,
            sourcePath:     sourcePath.trim(),
            targetFieldNo:  parseInt(targetFieldNo),
            transformType:  (isAddressMapping ? "TO_ADDRESS_VALUE" : transformType) as any,
            transformConfig: (isAddressMapping ? transformConfig : undefined),
            priority:       parseInt(priority) || 100,
            notes:          notes || undefined,
            mappingScope,
            payloadSubtype: (payloadSubtype === "NONE" || !payloadSubtype) ? null : payloadSubtype,
        });
        if (res.success) {
            if (res.warnings?.length) res.warnings.forEach((w: string) => toast.warning(w));
            toast.success(isEdit ? "Mapping updated" : "Mapping created");
            onSaved();
        } else {
            toast.error(res.error ?? "Failed to save");
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit" : "Add"} Source Mapping</DialogTitle>
                    <DialogDescription>
                        <span className="font-medium">{selectedOption.label}</span>
                        {selectedOption.sourceReference && (
                            <span className="ml-1 text-slate-400">· {selectedOption.sourceReference}</span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <TargetFieldPicker fieldDefs={fieldDefs} value={targetFieldNo} onChange={(val) => {
                        setTargetFieldNo(val);
                        const field = fieldDefs.find((f: any) => String(f.fieldNo) === val);
                        if (!isGleif && (field?.appDataType === "PARTY" || field?.appDataType === "PERSON_OR_CONTACT")) {
                            setPayloadSubtype("OFFICERS");
                        }
                    }} />

                    {isAddressMapping ? (
                        <>
                            {/* 1. Mapping Editor */}
                            <AddressMappingEditor config={transformConfig} onChangeConfig={setTransformConfig} mappingRootPath={sourcePath} samplePayload={samplePayload} />

                            {/* 2. Preview */}
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Preview</Label>
                                {loadingSample ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Resolving live sample data...</span>
                                    </div>
                                ) : (
                                    <AddressPostalPreview value={previewAddress} />
                                )}
                            </div>

                            {/* 3. Advanced Settings */}
                            <div className="border border-slate-100 dark:border-zinc-800 rounded-lg overflow-hidden mt-1">
                                <button
                                    type="button"
                                    onClick={() => setAdvancedOpen(!advancedOpen)}
                                    className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900/50 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
                                >
                                    <span>Advanced Settings</span>
                                    {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                                {advancedOpen && (
                                    <div className="p-3 space-y-3 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="v2-sourcePath">Source Path</Label>
                                            <Input
                                                id="v2-sourcePath"
                                                value={sourcePath}
                                                onChange={e => setSourcePath(e.target.value)}
                                                placeholder="e.g. company_name"
                                                className="font-mono text-sm"
                                                readOnly={!!initialSourcePath && !isEdit}
                                            />
                                            <p className="text-[10px] text-slate-400">Dot-notation path relative to payload root.</p>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="v2-priority">Priority</Label>
                                            <Input id="v2-priority" type="number" min={1} value={priority} onChange={e => setPriority(e.target.value)} />
                                            <p className="text-[10px] text-slate-400">Lower = higher precedence.</p>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="v2-notes">Notes (optional)</Label>
                                            <Input id="v2-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. UK registered company name" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid gap-1.5">
                                <Label htmlFor="v2-sourcePath">Source Path</Label>
                                <Input
                                    id="v2-sourcePath"
                                    value={sourcePath}
                                    onChange={e => setSourcePath(e.target.value)}
                                    placeholder="e.g. company_name"
                                    className="font-mono text-sm"
                                    readOnly={!!initialSourcePath && !isEdit}
                                />
                                <p className="text-[10px] text-slate-400">Dot-notation path relative to payload root.</p>
                            </div>

                            {isPersonOrContactMapping && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                        <Users className="w-4 h-4" />
                                        <span>Map all Officers as Person or Contact</span>
                                    </div>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                                        This will map the entire {payloadSubtype || "OFFICERS"} list into this repeating Person or Contact field using the system's standard structured extraction rules.
                                    </p>
                                </div>
                            )}

                            {/* Premium GLEIF Scope Selector */}
                            {isGleif && (
                                <div className="grid gap-2 my-2">
                                    <Label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">GLEIF Data Scope</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {[
                                            { id: "LEVEL_1", title: "Level 1 (Core)", desc: "Entity core data (name, address, status)." },
                                            { id: "LEVEL_2_RELATIONSHIPS", title: "Level 2 (Rel.)", desc: "Parents, funds, children, LOUs." },
                                            { id: "ELF", title: "ELF Data", desc: "Entity legal forms & jurisdiction." }
                                        ].map(opt => (
                                            <div 
                                                key={opt.id}
                                                onClick={() => setPayloadSubtype(opt.id)}
                                                className={cn(
                                                    "cursor-pointer rounded-lg border p-2.5 transition-all duration-200 hover:shadow-sm group",
                                                    payloadSubtype === opt.id 
                                                        ? "bg-gradient-to-br from-indigo-50 to-white border-indigo-200 dark:from-indigo-950/40 dark:to-zinc-900/50 dark:border-indigo-800/50 shadow-sm ring-1 ring-indigo-500/20"
                                                        : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-indigo-100 dark:hover:border-indigo-900/30"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={cn(
                                                        "text-[11px] font-semibold transition-colors",
                                                        payloadSubtype === opt.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-zinc-300 group-hover:text-indigo-600"
                                                    )}>{opt.title}</span>
                                                    {payloadSubtype === opt.id && <Check className="w-3 h-3 text-indigo-500" />}
                                                </div>
                                                <p className="text-[9px] text-slate-500 dark:text-zinc-400 leading-tight pr-2">{opt.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Scope / Subtype — fallback for RA debugging */}
                            {!isGleif && (
                                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded px-2.5 py-1.5 mt-1">
                                    <span className="text-slate-300">scope:</span>
                                    <span className="text-slate-500">{displayScope(mappingScope, selectedOption.sourceType)}</span>
                                    <span className="text-slate-200 mx-0.5">·</span>
                                    <span className="text-slate-300">subtype:</span>
                                    <span className="text-slate-500">{(!payloadSubtype || payloadSubtype === "NONE") ? "—" : payloadSubtype}</span>
                                </div>
                            )}

                            {!isPersonOrContactMapping && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label>Transform</Label>
                                        <Select value={transformType} onValueChange={setTransformType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {TRANSFORM_SELECT_OPTIONS.map(t => (
                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {transformDescription && (
                                            <p className="text-[11px] text-slate-500 leading-snug">
                                                {transformDescription}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="v2-priority">Priority</Label>
                                        <Input id="v2-priority" type="number" min={1} value={priority} onChange={e => setPriority(e.target.value)} />
                                        <p className="text-[10px] text-slate-400">Lower = higher precedence.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-1.5">
                                <Label htmlFor="v2-notes">Notes (optional)</Label>
                                <Input id="v2-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. UK registered company name" />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !sourcePath.trim() || !targetFieldNo}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isEdit ? "Update" : "Create"} Mapping
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Target Field Picker ───────────────────────────────────────────────────────

const DATA_TYPE_COLORS: Record<string, string> = {
    TEXT:    "bg-blue-50 text-blue-600 border-blue-100",
    NUMBER:  "bg-amber-50 text-amber-600 border-amber-100",
    DATE:    "bg-purple-50 text-purple-600 border-purple-100",
    BOOLEAN: "bg-teal-50 text-teal-600 border-teal-100",
    JSON:    "bg-orange-50 text-orange-600 border-orange-100",
    SELECT:  "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function TargetFieldPicker({ fieldDefs, value, onChange }: {
    fieldDefs: any[];
    value: string;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const selected = fieldDefs.find((f: any) => String(f.fieldNo) === value);
    const grouped = useMemo(() => {
        const g: Record<string, any[]> = {};
        for (const f of fieldDefs) {
            const cat = f.masterDataCategory?.displayName ?? "Uncategorized";
            (g[cat] = g[cat] ?? []).push(f);
        }
        return Object.entries(g).sort(([a], [b]) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b));
    }, [fieldDefs]);

    return (
        <div className="grid gap-1.5">
            <Label>Target Field <Badge variant="outline" className="text-[9px] font-normal text-slate-400 border-slate-200 px-1.5 ml-1">{fieldDefs.length} available</Badge></Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open}
                        className={cn("w-full justify-between h-auto min-h-[40px] py-2 font-normal text-left", !value && "text-slate-400")}>
                        {selected ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50 border-slate-200 text-slate-600">F{selected.fieldNo}</Badge>
                                <span className="truncate text-sm font-medium text-slate-800">{selected.fieldName}</span>
                                <Badge className={cn("text-[9px] px-1 py-0 border shrink-0 shadow-none", DATA_TYPE_COLORS[selected.appDataType] ?? "bg-slate-50 text-slate-500 border-slate-200")}>{selected.appDataType}</Badge>
                            </div>
                        ) : <span className="text-sm">Search and select a target field…</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search by name, number, or category…" />
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty>
                                <div className="flex flex-col items-center gap-1 py-6 text-slate-400">
                                    <Search className="h-5 w-5 opacity-40" />
                                    <span className="text-sm">No matching fields</span>
                                </div>
                            </CommandEmpty>
                            {grouped.map(([cat, fields]) => (
                                <CommandGroup key={cat} heading={<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{cat} ({fields.length})</span>}>
                                    {fields.map((f: any) => {
                                        const sel = String(f.fieldNo) === value;
                                        return (
                                            <CommandItem key={f.fieldNo} value={`${f.fieldNo} ${f.fieldName} ${cat}`}
                                                onSelect={() => { onChange(String(f.fieldNo)); setOpen(false); }}
                                                className={cn("flex items-center gap-2.5 py-2 px-2 cursor-pointer", sel && "bg-green-50/80")}>
                                                <div className={cn("flex items-center justify-center h-5 w-5 rounded-md border shrink-0", sel ? "bg-green-600 border-green-600 text-white" : "border-slate-200 bg-white text-transparent")}>
                                                    <Check className="h-3 w-3" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0 bg-slate-50/80 border-slate-200 text-slate-500 shadow-none">F{f.fieldNo}</Badge>
                                                <span className={cn("flex-1 text-sm truncate", sel ? "font-semibold text-green-800" : "text-slate-700")}>{f.fieldName}</span>
                                                <Badge className={cn("text-[9px] px-1.5 py-0 border shadow-none shrink-0", DATA_TYPE_COLORS[f.appDataType] ?? "bg-slate-50 text-slate-500 border-slate-200")}>{f.appDataType}</Badge>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
