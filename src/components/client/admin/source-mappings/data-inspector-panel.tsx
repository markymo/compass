"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ArrowRight, Check, PlusCircle, Globe } from "lucide-react";
import { fetchLiveGleifRecord } from "@/actions/gleif-live";
import { cn } from "@/lib/utils";

interface DataInspectorPanelProps {
    sourceType: string;
    existingMappings: any[];
    onSelectPath: (path: string) => void;
}

export function DataInspectorPanel({ sourceType, existingMappings, onSelectPath }: DataInspectorPanelProps) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // List of active source paths for highlighting
    const activePaths = new Set(
        existingMappings.filter(m => m.isActive).map(m => m.sourcePath)
    );

    const handleSearch = async () => {
        if (!query.trim() || query.length < 3) return;
        
        setLoading(true);
        setError(null);
        
        try {
            // Right now we only have GLEIF implemented for live fetch
            if (sourceType !== "GLEIF") {
                setError(`Live fetch not yet implemented for ${sourceType}`);
                setLoading(false);
                return;
            }
            
            const res = await fetchLiveGleifRecord(query);
            if (res.success) {
                setPayload(res.payload);
            } else {
                setError(res.error || "Failed to fetch data");
                setPayload(null);
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="flex flex-col h-[calc(100vh-12rem)] sticky top-6">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base text-slate-800">Live Data Inspector</CardTitle>
                </div>
                <CardDescription className="text-xs">
                    Search a real entity (e.g. "Apple Inc" or an LEI) to explore the exact JSON schema.
                </CardDescription>
                
                <div className="flex gap-2 mt-3 pt-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder="Enter LEI or Company Name..."
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
    onSelect 
}: { 
    data: any, 
    path?: string, 
    activePaths: Set<string>, 
    onSelect: (path: string) => void 
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
                                />
                            ) : (
                                <ValueNode 
                                    value={item} 
                                    itemPath={`${path}[${index}]`} 
                                    isMapped={activePaths.has(`${path}[${index}]`)} 
                                    onSelect={onSelect} 
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
            <div className="space-y-1">
                {keys.map(key => {
                    const value = data[key];
                    const childPath = path ? `${path}.${key}` : key;
                    const isObject = typeof value === 'object' && value !== null;
                    const isMapped = activePaths.has(childPath);
                    
                    return (
                        <div key={key} className="relative group">
                            {/* Object Key Row */}
                            <div className="flex items-center group-hover:bg-blue-50/50 py-0.5 px-1 rounded -ml-1 transition-colors">
                                <span className={cn(
                                    "font-mono text-[11px] font-semibold",
                                    isMapped ? "text-green-600" : "text-indigo-900"
                                )}>
                                    {key}:
                                </span>
                                
                                {/* If it's a primitive, show the value inline. If mapped, show checkmark */}
                                {!isObject && (
                                    <div className="ml-2 flex-1 flex items-center justify-between">
                                        <ValueNode value={value} itemPath={childPath} isMapped={isMapped} onSelect={onSelect} />
                                    </div>
                                )}
                                
                                {/* If it's an object/array, we just show the Add Mapping button here if hovered */}
                                {isObject && !isMapped && (
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MappingButton onClick={() => onSelect(childPath)} />
                                    </div>
                                )}
                                {isObject && isMapped && (
                                    <div className="ml-auto text-green-500 flex items-center gap-1 text-[10px] font-medium pr-1">
                                        <Check className="h-3 w-3" /> Mapped
                                    </div>
                                )}
                            </div>
                            
                            {/* Recursive Object/Array Body */}
                            {isObject && (
                                <div className="pl-4 ml-1.5 border-l border-slate-200 mt-0.5">
                                    <JsonTree 
                                        data={value} 
                                        path={childPath} 
                                        activePaths={activePaths} 
                                        onSelect={onSelect} 
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Fallback for root primitives (shouldn't happen in practical usage)
    return <ValueNode value={data} itemPath={path} isMapped={activePaths.has(path)} onSelect={onSelect} />;
}

// Leaf Node display (Primitive value + Mapping Button)
function ValueNode({ value, itemPath, isMapped, onSelect }: { value: any, itemPath: string, isMapped: boolean, onSelect: (path: string) => void }) {
    let displayValueType = "text-slate-600";
    if (typeof value === "string") displayValueType = "text-emerald-600";
    else if (typeof value === "number") displayValueType = "text-orange-600";
    else if (typeof value === "boolean") displayValueType = "text-blue-600";

    const displayStr = typeof value === "string" ? `"${value}"` : String(value);

    return (
        <div className="flex items-center justify-between w-full relative">
            <span className={cn("font-mono text-[11px] truncate max-w-[200px] xl:max-w-[280px]", displayValueType)} title={displayStr}>
                {displayStr}
            </span>
            
            {isMapped ? (
                <div className="text-green-500 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold tracking-wider absolute right-0">
                    <Check className="h-2.5 w-2.5" /> MAPPED
                </div>
            ) : (
                <div className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-white via-white to-transparent pl-4 pb-0.5">
                   <MappingButton onClick={() => onSelect(itemPath)} />
                </div>
            )}
        </div>
    );
}

function MappingButton({ onClick }: { onClick: () => void }) {
    return (
        <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors shadow-sm border border-blue-100"
        >
            <PlusCircle className="h-3 w-3" />
            Add
        </button>
    );
}
