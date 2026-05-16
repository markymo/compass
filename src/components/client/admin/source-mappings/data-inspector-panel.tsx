"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, PlusCircle, Globe } from "lucide-react";
import { fetchLiveGleifRecord } from "@/actions/gleif-live";
import { fetchLiveRegistryRecord } from "@/actions/registry-live";
import { cn } from "@/lib/utils";

interface DataInspectorPanelProps {
    sourceType: string;
    /** RA authority code, e.g. "RA000585" or "RA000192". Null/undefined for GLEIF. */
    sourceReference?: string | null;
    existingMappings: any[];
    onSelectPath: (path: string) => void;
    readOnly?: boolean;
    title?: string;
}

export function DataInspectorPanel({ 
    sourceType, 
    sourceReference,
    existingMappings, 
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
    const activePaths = new Set(
        existingMappings
            .filter(m =>
                m.isActive &&
                m.sourceType === sourceType &&
                (m.sourceReference ?? null) === (sourceReference ?? null)
            )
            .map(m => m.sourcePath)
    );

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
                            activePaths={activePaths} 
                            onSelect={onSelectPath} 
                            readOnly={readOnly}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Recursive JSON Tree Component
function JsonTree({ 
    data, 
    path = "", 
    activePaths, 
    onSelect,
    readOnly = false
}: { 
    data: any, 
    path?: string, 
    activePaths: Set<string>, 
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
                                    activePaths={activePaths} 
                                    onSelect={onSelect} 
                                    readOnly={readOnly}
                                />
                            ) : (
                                <ValueNode 
                                    value={item} 
                                    itemPath={`${path}[${index}]`} 
                                    isMapped={activePaths.has(`${path}[${index}]`)} 
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
                    const isMapped = activePaths.has(childPath);
                    
                    return (
                        <ObjectRow
                            key={key}
                            keyName={key}
                            value={value}
                            childPath={childPath}
                            isObject={isObject}
                            isMapped={isMapped}
                            activePaths={activePaths}
                            onSelect={onSelect}
                            readOnly={readOnly}
                        />
                    );
                })}
            </div>
        );
    }

    return <ValueNode value={data} itemPath={path} isMapped={activePaths.has(path)} onSelect={onSelect} readOnly={readOnly} />;
}

// Fix 2: Extracted row into its own component with local hover state.
// The "Add" button is always visible (not opacity-0), and the row gets a
// blue tint when hovered to indicate the "active" row clearly.
function ObjectRow({
    keyName,
    value,
    childPath,
    isObject,
    isMapped,
    activePaths,
    onSelect,
    readOnly,
}: {
    keyName: string;
    value: any;
    childPath: string;
    isObject: boolean;
    isMapped: boolean;
    activePaths: Set<string>;
    onSelect: (path: string) => void;
    readOnly: boolean;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={cn(
                "relative rounded transition-colors",
                isHovered && !isMapped && "bg-blue-50/60"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Key Row */}
            <div className="flex items-center py-0.5 px-1 -ml-1">
                <span className={cn(
                    "font-mono text-[11px] font-semibold",
                    isMapped ? "text-green-600" : "text-indigo-900"
                )}>
                    {keyName}:
                </span>

                {/* Inline primitive value */}
                {!isObject && (
                    <div className="ml-2 flex-1 flex items-center justify-between min-w-0">
                        <ValueNode 
                            value={value} 
                            itemPath={childPath} 
                            isMapped={isMapped} 
                            onSelect={onSelect} 
                            readOnly={readOnly}
                            isRowHovered={isHovered}
                        />
                    </div>
                )}

                {/* Object/array level Add or Mapped badge */}
                {isObject && !readOnly && (
                    <div className="ml-auto pl-2 shrink-0">
                        {isMapped ? (
                            <div className="text-green-500 flex items-center gap-1 text-[10px] font-medium pr-1">
                                <Check className="h-3 w-3" /> Mapped
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
                        activePaths={activePaths} 
                        onSelect={onSelect} 
                        readOnly={readOnly}
                    />
                </div>
            )}
        </div>
    );
}

// Leaf Node display (Primitive value + Mapping Button)
function ValueNode({ 
    value, 
    itemPath, 
    isMapped, 
    onSelect,
    readOnly = false,
    isRowHovered = false,
}: { 
    value: any, 
    itemPath: string, 
    isMapped: boolean, 
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
            
            {isMapped ? (
                <div className="text-green-500 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold tracking-wider shrink-0">
                    <Check className="h-2.5 w-2.5" /> MAPPED
                </div>
            ) : !readOnly ? (
                <div className="shrink-0">
                    <MappingButton onClick={() => onSelect(itemPath)} visible={isRowHovered} />
                </div>
            ) : null}
        </div>
    );
}

// Fix 2: Button is always rendered but visually prominent only when the row is hovered.
// This ensures it is discoverable (always present) while the row highlight
// provides the "active row" cue the user requested.
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
