"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCheck, Network, User, Building2, MapPin, Briefcase } from "lucide-react";
import { FieldCandidate } from "@/services/kyc/normalization/types";

// Helper to map known fields
const FIELD_MAP: Record<number, { label: string, icon: any, color: string }> = {
    62: { label: "Ultimate Beneficial Owners", icon: FingerprintIcon, color: "emerald" },
    63: { label: "Directors & Officers", icon: Briefcase, color: "blue" },
    120: { label: "Registered Addresses", icon: MapPin, color: "orange" },
}

function FingerprintIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" /><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        </svg>
    )
}

function AddressCard({ data }: { data: any }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 w-64 flex-shrink-0 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1">
                <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 font-normal">ADDRESS</Badge>
            </div>
            <div className="flex items-start gap-3 mt-1">
                <div className="p-2 bg-orange-50 dark:bg-orange-950/30 text-orange-600 rounded-md">
                    <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate text-slate-800 dark:text-slate-200">{data.line1 || "-"}</div>
                    <div className="text-xs text-slate-500 truncate">{[data.city, data.postalCode, data.country].filter(Boolean).join(", ")}</div>
                </div>
            </div>
        </div>
    );
}

function PartyCard({ data }: { data: any }) {
    const isLe = data.metadata_type === 'LEGAL_ENTITY';
    const Icon = isLe ? Building2 : User;
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 w-[300px] flex-shrink-0 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
            <div className="absolute top-0 right-0 p-1">
                <Badge variant="outline" className={`text-[9px] font-normal ${isLe ? "bg-blue-50 text-blue-500 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
                    {isLe ? "COMPANY" : "PERSON"}
                </Badge>
            </div>
            
            <div className="flex items-start gap-3 mt-1 relative z-10">
                <div className={`p-2 rounded-md ${isLe ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pr-6 pb-1">
                    <div className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">
                        {isLe ? data.name : `${data.firstName || ''} ${data.lastName}`.trim()}
                    </div>
                    {isLe ? (
                        <div className="text-xs text-slate-500 font-mono truncate">{data.registrationNumber || data.legalForm || "Corporate Entity"}</div>
                    ) : (
                        <div className="text-xs text-slate-500 truncate">{data.primaryNationality ? `Nationality: ${data.primaryNationality}` : "Individual"}</div>
                    )}
                </div>
            </div>

            {data.address && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{data.address.line1 || "-"}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                                {[data.address.city, data.address.postalCode, data.address.country].filter(Boolean).join(", ")}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ExtractedCandidatesViewer({ candidates }: { candidates: FieldCandidate[] }) {
    const [viewMode, setViewMode] = useState<"graph" | "json">("graph");
    const [copied, setCopied] = useState(false);

    if (!candidates || candidates.length === 0) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(candidates, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Group candidates by field
    const groups: Record<number, any[]> = {};
    candidates.forEach(c => {
        if (!groups[c.fieldNo]) groups[c.fieldNo] = [];
        if (Array.isArray(c.value)) {
            groups[c.fieldNo].push(...c.value);
        } else {
            groups[c.fieldNo].push(c.value);
        }
    });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/40 shadow-sm">
                    <Network className="h-3.5 w-3.5 mr-1.5" />
                    Preview Extracted Entities
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Network className="h-5 w-5 text-emerald-500" />
                            Extracted Entity Graph
                        </DialogTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            A preview of the structured Master Data entities ready to be ingested.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
                            <Button 
                                variant={viewMode === "graph" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-7 text-xs px-3 shadow-none"
                                onClick={() => setViewMode("graph")}
                            >
                                Visual
                            </Button>
                            <Button 
                                variant={viewMode === "json" ? "secondary" : "ghost"} 
                                size="sm" 
                                className="h-7 text-xs px-3 shadow-none"
                                onClick={() => setViewMode("json")}
                            >
                                JSON
                            </Button>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={copyToClipboard}
                            className="h-8 text-xs"
                        >
                            {copied ? <CheckCheck className="h-4 w-4 mr-1.5 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    </div>
                </DialogHeader>
                
                <div className="flex-1 overflow-auto p-6">
                    {viewMode === "json" ? (
                        <div className="bg-[#0d1117] rounded-lg p-4 overflow-auto border border-slate-800">
                            <pre className="text-sm font-mono text-emerald-400">
                                {JSON.stringify(candidates, null, 2)}
                            </pre>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-10">
                            {/* Central Node representing the Target Entity being enriched */}
                            <div className="flex flex-col items-center justify-center pt-2">
                                <div className="bg-emerald-600 text-white p-3 rounded-full shadow-lg shadow-emerald-500/20 z-10">
                                    <Building2 className="h-8 w-8" />
                                </div>
                                <div className="mt-3 font-bold text-lg text-slate-800 dark:text-slate-200">
                                    Target Subject
                                </div>
                                <div className="text-sm text-slate-500">Root Node</div>
                                {/* Stem connector extending downwards */}
                                <div className="h-10 border-l-2 border-dashed border-emerald-300 dark:border-emerald-700/50 mt-4"></div>
                            </div>

                            {/* Branches */}
                            <div className="space-y-12 max-w-5xl mx-auto px-4 relative">
                                {/* Connecting vertical line continuing behind groups */}
                                <div className="absolute left-1/2 top-0 bottom-0 -ml-[1px] border-l-2 border-dashed border-emerald-200 dark:border-emerald-900/30 -z-10"></div>
                                
                                {Object.entries(groups).map(([fieldNoStr, items]) => {
                                    const fieldNo = parseInt(fieldNoStr, 10);
                                    const mapping = FIELD_MAP[fieldNo] || { label: `Target Field ${fieldNo}`, icon: Network, color: "slate" };
                                    const Icon = mapping.icon;
                                    
                                    return (
                                        <div key={fieldNo} className="relative z-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-6 shadow-sm">
                                            {/* Branch Connector Node */}
                                            <div className="absolute -top-3 left-1/2 -ml-3 bg-white dark:bg-slate-950 p-1 rounded-full border border-emerald-200 dark:border-emerald-800 text-emerald-500">
                                                <Icon className="h-4 w-4" />
                                            </div>

                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base">{mapping.label}</h3>
                                                    <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">F{fieldNo}</Badge>
                                                </div>
                                                <div className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                                                    {items.length} Nodes Extracted
                                                </div>
                                            </div>

                                            <ScrollArea className="w-full whitespace-nowrap rounded-xl pb-4">
                                                <div className="flex w-max gap-4 p-1">
                                                    {items.map((item, idx) => {
                                                        // Render Address or Party based on heuristic
                                                        if (typeof item === 'object' && ('line1' in item || 'postalCode' in item || 'city' in item)) {
                                                            return <AddressCard key={idx} data={item} />;
                                                        }
                                                        if (typeof item === 'object' && ('metadata_type' in item)) {
                                                            return <PartyCard key={idx} data={item} />;
                                                        }
                                                        
                                                        // Fallback generic card
                                                        return (
                                                            <div key={idx} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 w-48 shadow-sm">
                                                                <div className="text-xs font-mono text-slate-500 truncate">{JSON.stringify(item)}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <ScrollBar orientation="horizontal" />
                                            </ScrollArea>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
