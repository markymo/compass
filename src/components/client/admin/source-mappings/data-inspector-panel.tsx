"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, PlusCircle, Globe, Tag } from "lucide-react";
import { fetchLiveGleifRecord } from "@/actions/gleif-live";
import { fetchLiveRegistryRecord } from "@/actions/registry-live";
import { cn } from "@/lib/utils";

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
    /** RA authority code, e.g. "RA000585" or "RA000192". Null/undefined for GLEIF. */
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
    title
}: DataInspectorPanelProps) {
    const defaultQuery =
        sourceType === "GLEIF" ? "213800SN8QHYGA7QUF79"
        : sourceReference === "RA000192" ? "542051180"
        : "04155137";

    const [query, setQuery] = useState(defaultQuery);
    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

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
                const res = await fetchLiveRegistryRecord(query, sourceReference || "RA000585");
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
                        />
                    </div>
                )}
            </CardContent>
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
    readOnly = false
}: { 
    data: any,
    path?: string,
    thisFieldPaths: Set<string>,
    otherFieldPathMap: Map<string, { fieldNo: number; fieldName: string }>,
    onSelect: (path: string) => void,
    readOnly?: boolean
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
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={cn(
                "relative rounded transition-colors",
                isHovered && !isMappedHere && "bg-blue-50/60"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Key Row */}
            <div className="flex items-center py-0.5 px-1 -ml-1">
                <span className={cn(
                    "font-mono text-[11px] font-semibold",
                    isMappedHere ? "text-green-600" : otherFieldMapping ? "text-amber-600" : "text-indigo-900"
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
                    <div className="ml-auto pl-2 shrink-0">
                        {isMappedHere ? (
                            <ThisFieldBadge />
                        ) : otherFieldMapping ? (
                            <div className="flex items-center gap-1">
                                <OtherFieldBadge fieldNo={otherFieldMapping.fieldNo} fieldName={otherFieldMapping.fieldName} />
                                <MappingButton onClick={() => onSelect(childPath)} visible={isHovered} />
                            </div>
                        ) : (
                            <MappingButton onClick={() => onSelect(childPath)} visible={isHovered} />
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
