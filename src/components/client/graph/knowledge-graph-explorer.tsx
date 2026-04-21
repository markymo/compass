"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { 
    Users, Building2, MapPin, ShieldCheck, Star, 
    ChevronRight, ChevronDown, Info, Calendar, Globe, Hash,
    ArrowUpRight, History, FileText, Search, Maximize2, Minimize2
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface KnowledgeGraphExplorerProps {
    leName: string;
    nodes: any[];
    claims: any[];
    graphEdges: any[];
    rootLegalEntityId?: string | null;
    activeDirectorPersonIds?: string[];
    activePSCNodeIds?: string[];
}

export function KnowledgeGraphExplorer({
    leName,
    nodes,
    claims,
    graphEdges,
    activeDirectorPersonIds = [],
}: KnowledgeGraphExplorerProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [showOnlyCurrent, setShowOnlyCurrent] = useState(false);

    // --- State Helpers ---
    const togglePath = (path: string) => {
        const next = new Set(expandedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpandedPaths(next);
    };

    const expandAllActive = () => {
        const activePaths = ["officers", "psc", "companies"];
        setExpandedPaths(new Set(activePaths));
    };

    const collapseAll = () => setExpandedPaths(new Set());

    // --- Data Shaping (Tree Structure) ---
    const sortedData = useMemo(() => {
        const officers = { active: [] as any[], former: [] as any[] };
        const psc = { active: [] as any[], former: [] as any[] };
        const orphanAddresses = [] as any[];
        const companies = [] as any[];
        const rootAddresses = [] as any[];

        const findAddressForNode = (personId?: string | null, leId?: string | null) => {
            if (!personId && !leId) return null;
            const claim = claims.find(c => 
                (personId && c.subjectPersonId === personId && c.valueAddressId) ||
                (leId && c.subjectLeId === leId && c.valueAddressId)
            );
            if (!claim) return null;
            const addrNode = nodes.find(n => n.nodeType === 'ADDRESS' && n.addressId === claim.valueAddressId);
            return addrNode;
        };

        const pscEdgeMap = new Map();
        graphEdges.filter(e => e.edgeType === 'PSC_CONTROL').forEach(e => {
            pscEdgeMap.set(e.fromNodeId, e);
        });

        nodes.forEach(node => {
            const addrNode = findAddressForNode(node.personId, node.legalEntityId);
            const nodeWithAddr = { ...node, addressNode: addrNode };

            if (pscEdgeMap.has(node.id)) {
                const edge = pscEdgeMap.get(node.id);
                if (edge.isActive) psc.active.push({ ...nodeWithAddr, pscEdge: edge });
                else psc.former.push({ ...nodeWithAddr, pscEdge: edge });
            }

            if (node.nodeType === 'PERSON') {
                const isActive = node.personId && activeDirectorPersonIds.includes(node.personId);
                if (isActive) officers.active.push(nodeWithAddr);
                else if (!pscEdgeMap.has(node.id)) officers.former.push(nodeWithAddr);
            }

            if (node.nodeType === 'LEGAL_ENTITY' && !pscEdgeMap.has(node.id)) {
                companies.push(nodeWithAddr);
            }
        });

        nodes.forEach(node => {
            if (node.nodeType === 'ADDRESS') {
                const parentClaim = claims.find(c => c.valueAddressId === node.addressId);
                if (parentClaim?.subjectLeId && !nodes.find(n => n.legalEntityId === parentClaim.subjectLeId && n.id !== node.id)) {
                    rootAddresses.push(node);
                } else {
                    const linked = claims.some(c => c.valueAddressId === node.addressId && (c.subjectLeId || c.subjectPersonId));
                    if (!linked) orphanAddresses.push(node);
                }
            }
        });

        return { officers, psc, orphanAddresses, companies, rootAddresses };
    }, [nodes, claims, graphEdges, activeDirectorPersonIds]);

    const selectedNode = useMemo(() => {
        const allEnrichedNodes = [
            ...sortedData.officers.active,
            ...sortedData.officers.former,
            ...sortedData.psc.active,
            ...sortedData.psc.former,
            ...sortedData.companies,
            ...sortedData.orphanAddresses,
            ...sortedData.rootAddresses
        ];
        return allEnrichedNodes.find(n => n.id === selectedNodeId);
    }, [selectedNodeId, sortedData]);

    const getDisplayName = (node: any) => {
        if (node.nodeType === 'PERSON') return `${node.person?.firstName} ${node.person?.lastName}`;
        if (node.nodeType === 'LEGAL_ENTITY') return node.legalEntity?.name;
        if (node.nodeType === 'ADDRESS') return node.address?.line1;
        return "Unknown";
    };

    return (
        <div className="flex flex-col gap-16 pb-20 overflow-hidden">
            
            {/* Minimal Tree Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-2 border-b border-slate-100/60 bg-white/40 backdrop-blur sticky top-0 z-30">
                <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-3">
                        <Switch 
                            id="current-only" 
                            checked={showOnlyCurrent}
                            onCheckedChange={setShowOnlyCurrent}
                        />
                        <Label htmlFor="current-only" className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] cursor-pointer hover:text-slate-600 transition-colors">Current Structure Only</Label>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={expandAllActive} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest gap-2 bg-indigo-50/30 hover:bg-indigo-50 px-3">
                        <Maximize2 className="h-3 w-3" /> Expand Active
                    </Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll} className="text-[10px] font-bold text-slate-400 hover:text-slate-500 uppercase tracking-widest gap-2 px-3">
                        <Minimize2 className="h-3 w-3" /> Collapse
                    </Button>
                </div>
            </div>

            {/* Tree Layout Container */}
            <div className="pl-6 max-w-5xl w-full self-center">
                
                {/* Level 0: The Root Portal */}
                <div className="relative mb-12 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-6 group cursor-default">
                        <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm shrink-0 z-10 transition-all group-hover:border-indigo-100 group-hover:shadow-md">
                            <Building2 className="h-7 w-7 text-slate-800 group-hover:text-indigo-600 transition-colors" />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight truncate leading-none">{leName}</h2>
                            <div className="flex items-center gap-4 text-[10px] font-semibold tracking-wide text-slate-400">
                                <span className="flex items-center gap-1.5"><Globe className="h-3 w-3 opacity-60" /> Registry Master</span>
                                {sortedData.rootAddresses.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedNodeId(sortedData.rootAddresses[0].id)}
                                        className="flex items-center gap-1.5 text-indigo-500 hover:text-indigo-700 transition-colors group/addr"
                                    >
                                        <MapPin className="h-3 w-3 opacity-60 group-hover/addr:opacity-100" /> 
                                        <span className="underline decoration-indigo-100 underline-offset-4">{sortedData.rootAddresses[0].address?.line1}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Main vertical tree stem */}
                    <div className="absolute left-7 top-14 bottom-[-24px] w-px bg-slate-100/80" />
                </div>

                {/* Level 1: Clean Typographic Branches */}
                <div className="space-y-8">
                    
                    {/* Officers Branch */}
                    {(sortedData.officers.active.length > 0 || (!showOnlyCurrent && sortedData.officers.former.length > 0)) && (
                        <TreeBranch 
                            icon={<Users className="h-4 w-4" />}
                            title="Officers"
                            activeCount={sortedData.officers.active.length}
                            formerCount={!showOnlyCurrent ? sortedData.officers.former.length : 0}
                            isExpanded={expandedPaths.has("officers")}
                            onToggle={() => togglePath("officers")}
                        >
                            {/* Level 2: Active Nodes */}
                            <div className="space-y-px">
                                {sortedData.officers.active.map(node => (
                                    <TreeNode 
                                        key={node.id}
                                        icon={<Star className="h-3.5 w-3.5 text-amber-400" />}
                                        label={getDisplayName(node)}
                                        sublabel="Director"
                                        isExpanded={expandedPaths.has(node.id)}
                                        onToggle={() => togglePath(node.id)}
                                        onSelect={() => setSelectedNodeId(node.id)}
                                    >
                                        <DetailLeaf icon={<MapPin className="h-3 w-3" />} label="Service Address" value={node.addressNode?.address?.line1 || "Not specified"} />
                                        <DetailLeaf icon={<FileText className="h-3 w-3" />} label="Source Ref" value={`${node.source} Record`} />
                                    </TreeNode>
                                ))}
                            </div>

                            {/* Level 2: Historical Subsection */}
                            {!showOnlyCurrent && sortedData.officers.former.length > 0 && (
                                <div className="mt-4 pt-2 border-t border-slate-50">
                                    <TreeNode 
                                        icon={<History className="h-3.5 w-3.5" />}
                                        label="Former Officers"
                                        sublabel={`${sortedData.officers.former.length} Resigned`}
                                        variant="ghost"
                                        isExpanded={expandedPaths.has("former-officers")}
                                        onToggle={() => togglePath("former-officers")}
                                    >
                                        {sortedData.officers.former.map(node => (
                                            <TreeNode 
                                                key={node.id}
                                                icon={<Users className="h-3.5 w-3.5 text-slate-300" />}
                                                label={getDisplayName(node)}
                                                sublabel="Resigned Officer"
                                                status="ceased"
                                                isExpanded={expandedPaths.has(node.id)}
                                                onToggle={() => togglePath(node.id)}
                                                onSelect={() => setSelectedNodeId(node.id)}
                                            >
                                                <DetailLeaf icon={<Calendar className="h-3 w-3" />} label="Actioned On" value="Metadata Unavailable" />
                                            </TreeNode>
                                        ))}
                                    </TreeNode>
                                </div>
                            )}
                        </TreeBranch>
                    )}

                    {/* PSC Branch */}
                    {(sortedData.psc.active.length > 0 || (!showOnlyCurrent && sortedData.psc.former.length > 0)) && (
                        <TreeBranch 
                            icon={<ShieldCheck className="h-4 w-4" />}
                            title="Ownership & Control"
                            activeCount={sortedData.psc.active.length}
                            formerCount={!showOnlyCurrent ? sortedData.psc.former.length : 0}
                            isExpanded={expandedPaths.has("psc")}
                            onToggle={() => togglePath("psc")}
                        >
                            <div className="space-y-px">
                                {sortedData.psc.active.map(node => (
                                    <TreeNode 
                                        key={node.id}
                                        icon={<ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />}
                                        label={getDisplayName(node)}
                                        sublabel={node.pscEdge?.naturesOfControl?.[0]?.replace(/-/g, ' ') || "Controller"}
                                        isExpanded={expandedPaths.has(node.id)}
                                        onToggle={() => togglePath(node.id)}
                                        onSelect={() => setSelectedNodeId(node.id)}
                                    >
                                        <DetailLeaf icon={<Globe className="h-3 w-3" />} label="Power" value={node.pscEdge?.naturesOfControl?.[0]?.replace(/-/g, ' ') || "Significant Control"} />
                                        <DetailLeaf icon={<MapPin className="h-3 w-3" />} label="Location" value={node.addressNode?.address?.line1 || "Registry Record"} />
                                    </TreeNode>
                                ))}
                                {!showOnlyCurrent && sortedData.psc.former.length > 0 && (
                                    <div className="mt-4 pt-2 border-t border-slate-50">
                                        <TreeNode 
                                            icon={<History className="h-3.5 w-3.5" />}
                                            label="Historical Control"
                                            sublabel="Ceased Relationships"
                                            variant="ghost"
                                            isExpanded={expandedPaths.has("former-psc")}
                                            onToggle={() => togglePath("former-psc")}
                                        >
                                            {sortedData.psc.former.map(node => (
                                                <TreeNode 
                                                    key={node.id}
                                                    icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-200" />}
                                                    label={getDisplayName(node)}
                                                    sublabel="Former Controller"
                                                    status="ceased"
                                                    isExpanded={expandedPaths.has(node.id)}
                                                    onToggle={() => togglePath(node.id)}
                                                    onSelect={() => setSelectedNodeId(node.id)}
                                                >
                                                    <DetailLeaf icon={<Calendar className="h-3 w-3" />} label="End Date" value={node.pscEdge?.ceasedOn || "Record Archived"} />
                                                </TreeNode>
                                            ))}
                                        </TreeNode>
                                    </div>
                                )}
                            </div>
                        </TreeBranch>
                    )}

                    {/* Entities Branch */}
                    {sortedData.companies.length > 0 && (
                        <TreeBranch 
                            icon={<Building2 className="h-4 w-4" />}
                            title="Associated Entities"
                            activeCount={sortedData.companies.length}
                            isExpanded={expandedPaths.has("companies")}
                            onToggle={() => togglePath("companies")}
                        >
                            <div className="space-y-px">
                                {sortedData.companies.map(node => (
                                    <TreeNode 
                                        key={node.id}
                                        icon={<Building2 className="h-3.5 w-3.5 text-blue-400" />}
                                        label={getDisplayName(node)}
                                        sublabel="Corporate Node"
                                        isExpanded={expandedPaths.has(node.id)}
                                        onToggle={() => togglePath(node.id)}
                                        onSelect={() => setSelectedNodeId(node.id)}
                                    >
                                        <DetailLeaf icon={<MapPin className="h-3 w-3" />} label="Office" value={node.addressNode?.address?.line1 || "Registered Location"} />
                                    </TreeNode>
                                ))}
                            </div>
                        </TreeBranch>
                    )}

                    {/* Passive Branch: Locations */}
                    {sortedData.orphanAddresses.length > 0 && (
                        <TreeBranch 
                            icon={<MapPin className="h-4 w-4" />}
                            title="Secondary Locations"
                            activeCount={sortedData.orphanAddresses.length}
                            isExpanded={expandedPaths.has("addresses")}
                            onToggle={() => togglePath("addresses")}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-4 px-2">
                                {sortedData.orphanAddresses.map(node => (
                                    <button 
                                        key={node.id}
                                        onClick={() => setSelectedNodeId(node.id)}
                                        className="flex flex-col text-left group"
                                    >
                                        <div className="text-[11px] font-bold text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                                            {node.address?.line1}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                            {node.address?.city}, {node.address?.postcode}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </TreeBranch>
                    )}
                </div>
            </div>

            <Sheet open={!!selectedNodeId} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
                <SheetContent className="sm:max-w-md w-full h-full p-0 flex flex-col overflow-hidden">
                    {selectedNode && (
                        <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                            <SheetHeader className="p-10 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm text-indigo-500">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest leading-none">
                                        {(selectedNode.isActive ?? true) ? 'Active' : 'Archived'}
                                    </span>
                                </div>
                                <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{getDisplayName(selectedNode)}</SheetTitle>
                                <SheetDescription className="text-slate-500 text-sm font-medium mt-2">
                                    Registry relationship deep-dive and evidence records
                                </SheetDescription>
                            </SheetHeader>
                            
                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                                <div className="space-y-12">
                                    <section className="space-y-6">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Engagement</h4>
                                        <div className="space-y-5">
                                            <InfoRow icon={<Users className="h-4 w-4" />} label="Classification" value={selectedNode.nodeType === 'PERSON' ? 'Individual' : 'Legal Org'} />
                                            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Observed On" value={new Date(selectedNode.updatedAt).toLocaleDateString()} />
                                        </div>
                                    </section>
                                    
                                    <Separator className="bg-slate-100/60" />

                                    {/* Entity/Person Metadata */}
                                    <section className="space-y-6">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Identity Details</h4>
                                        <div className="space-y-4">
                                            {selectedNode.nodeType === 'PERSON' ? (
                                                <>
                                                    <InfoRow icon={<Globe className="h-4 w-4" />} label="Nationality" value={selectedNode.person?.primaryNationality || 'Citizen'} />
                                                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={selectedNode.person?.metadata?.dob || 'Not Publicly Disclosed'} />
                                                    <InfoRow icon={<Star className="h-4 w-4" />} label="Occupation" value={selectedNode.person?.metadata?.occupation || 'Officer'} />
                                                </>
                                            ) : selectedNode.nodeType === 'LEGAL_ENTITY' ? (
                                                <>
                                                    <InfoRow icon={<Hash className="h-4 w-4" />} label="Reg. Number" value={selectedNode.legalEntity?.localRegistrationNumber || 'Unknown'} />
                                                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Legal Form" value={selectedNode.legalEntity?.metadata?.legal_form || 'Company'} />
                                                </>
                                            ) : (
                                                <>
                                                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Association" value={selectedNode.parentName || 'Root Entity'} />
                                                    <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-sm font-medium text-slate-600 leading-relaxed italic">
                                                        {selectedNode.address?.line1}, {selectedNode.address?.city}, {selectedNode.address?.postcode}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </section>

                                    <Separator className="bg-slate-100/60" />

                                    {/* Graph Connectivity (Edges) */}
                                    <section className="space-y-6">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] px-1">Graph Connectivity</h4>
                                        <div className="space-y-3">
                                            {/* 1. Control Edges (PSC) */}
                                            {graphEdges
                                                .filter(e => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id)
                                                .map(e => (
                                                    <EdgeRow 
                                                        key={e.id}
                                                        icon={<ShieldCheck className="h-3.5 w-3.5" />}
                                                        label={e.edgeType === 'PSC_CONTROL' ? 'Control Relationship' : e.edgeType}
                                                        target={e.fromNodeId === selectedNode.id ? "Subject LE" : "Source Entity"}
                                                        status={e.isActive ? "Active" : "Historical"}
                                                    />
                                                ))}
                                            
                                            {/* 2. System Claims (Directorships/Addresses) */}
                                            {claims
                                                .filter(c => 
                                                    (selectedNode.personId && c.valuePersonId === selectedNode.personId) ||
                                                    (selectedNode.personId && c.subjectPersonId === selectedNode.personId) ||
                                                    (selectedNode.legalEntityId && c.subjectLeId === selectedNode.legalEntityId)
                                                )
                                                .map((c, idx) => (
                                                    <EdgeRow 
                                                        key={idx}
                                                        icon={<Hash className="h-3.5 w-3.5" />}
                                                        label={c.fieldNo === 63 ? 'Officer Appointment' : `Data Edge (Field ${c.fieldNo})`}
                                                        target={c.fieldNo === 63 ? 'Active Directors Registry' : 'Master Data Map'}
                                                        status="Verified"
                                                    />
                                                ))}

                                            {/* 3. Address Links */}
                                            {selectedNode.addressNode && (
                                                <EdgeRow 
                                                    icon={<MapPin className="h-3.5 w-3.5" />}
                                                    label="Verified Location"
                                                    target={selectedNode.addressNode.address?.line1}
                                                    status="Primary"
                                                />
                                            )}

                                            {!selectedNode.addressNode && graphEdges.filter(e => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id).length === 0 && 
                                             claims.filter(c => (selectedNode.personId && c.valuePersonId === selectedNode.personId) || (selectedNode.personId && c.subjectPersonId === selectedNode.personId)).length === 0 && (
                                                <div className="text-[10px] text-slate-400 italic px-1">No secondary edges detected for this node.</div>
                                             )}
                                        </div>
                                    </section>
                                    
                                    <Separator className="bg-slate-100/60" />

                                    <section className="space-y-6">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Proof Hub</h4>
                                        <div className="space-y-5">
                                            <InfoRow icon={<FileText className="h-4 w-4" />} label="Registry Ref" value={selectedNode.id.split('-')[0].toUpperCase()} />
                                            <InfoRow icon={<Globe className="h-4 w-4" />} label="System Source" value={selectedNode.source || "Registry Gateway"} />
                                            <button className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 hover:shadow-md transition-all group mt-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">Raw JSON Payload</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-300">v1.2</span>
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

// ── Refined Tree Helpers ────────────────────────────────────────────────────

function TreeBranch({ icon, title, activeCount, formerCount = 0, isExpanded, onToggle, children }: { icon: any, title: string, activeCount: number, formerCount?: number, isExpanded: boolean, onToggle: () => void, children: React.ReactNode }) {
    return (
        <div className="relative">
            {/* Horizontal entry line from main stem */}
            <div className="absolute left-7 top-6 w-6 h-px bg-slate-100/80" />
            
            <button 
                onClick={onToggle}
                className="flex items-center gap-3 py-2 px-2 group ml-12 transition-all"
            >
                <div className={cn(
                    "p-1.5 rounded-lg transition-colors shrink-0",
                    isExpanded ? "text-indigo-500" : "text-slate-400"
                )}>
                    {icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight leading-none">{title}</h3>
                <span className="text-xs font-medium text-slate-400 opacity-80 mt-0.5">
                    ({activeCount} active {formerCount > 0 && `· ${formerCount} historical`})
                </span>
                <div className="ml-2 group-hover:translate-x-0.5 transition-transform">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                </div>
            </button>

            {/* Sub-branch stem & content */}
            {isExpanded && (
                <div className="pl-[68px] pt-4 relative animate-in fade-in slide-in-from-left-1 duration-300">
                    <div className="absolute left-10 top-0 bottom-6 w-px bg-slate-100/80" />
                    {children}
                </div>
            )}
        </div>
    );
}

function TreeNode({ icon, label, sublabel, status = "active", isExpanded, onToggle, onSelect, variant = "primary", children }: { icon: any, label: string, sublabel: string, status?: "active" | "ceased", isExpanded: boolean, onToggle: () => void, onSelect?: () => void, variant?: "primary" | "ghost", children?: React.ReactNode }) {
    return (
        <div className="relative mb-2">
            {/* Horizontal line from sub-branch stem */}
            <div className="absolute left-[-28px] top-5 w-6 h-px bg-slate-100/80" />
            
            <div className="flex flex-col">
                <div className="flex items-center gap-2 group max-w-2xl px-2">
                    <div 
                        onClick={onSelect || onToggle}
                        className={cn(
                            "flex-1 flex items-center justify-between py-3 px-3 rounded-xl transition-all",
                            onSelect ? "cursor-pointer hover:bg-slate-50/80" : "cursor-default",
                        )}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "shrink-0 transition-colors",
                                status === "active" ? "text-indigo-400" : "text-slate-200"
                            )}>{icon}</div>
                            <div className="min-w-0">
                                <div className={cn(
                                    "text-sm font-semibold truncate leading-tight",
                                    status === "active" ? "text-slate-900" : "text-slate-400"
                                )}>{label}</div>
                                <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                                    {sublabel} · {status === "active" ? "Active" : "Historical"}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {children && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors relative z-10"
                                >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-300" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                                </button>
                            )}
                            {onSelect && !children && <ChevronRight className="h-4 w-4 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                    </div>
                </div>

                {/* Level 3: Leaf Details */}
                {isExpanded && children && (
                    <div className="pl-14 pt-1 space-y-1 relative animate-in fade-in duration-300">
                        <div className="absolute left-5 top-[-4px] bottom-5 w-px bg-slate-50" />
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailLeaf({ icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="relative group flex items-start gap-3 py-1.5 px-3 hover:bg-slate-50/40 rounded-lg transition-colors cursor-default max-w-xl">
            {/* Visual lead from level 2 stem */}
            <div className="absolute left-[-42px] top-4 w-8 h-px bg-slate-50" />
            <div className="text-slate-200 group-hover:text-indigo-300 transition-colors mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-0.5 block">{label}</span>
                <span className="text-[11px] font-medium text-slate-500 truncate block leading-tight">{value}</span>
            </div>
        </div>
    );
}

function EdgeRow({ icon, label, target, status }: { icon: any, label: string, target: string, status: string }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/30 group">
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-white border border-slate-100 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</div>
                    <div className="text-[12px] font-semibold text-slate-700 truncate">{target}</div>
                </div>
            </div>
            <Badge variant="outline" className="bg-white text-[9px] font-bold text-slate-400 uppercase px-2 py-0 h-5">
                {status}
            </Badge>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="text-slate-200 mt-1 shrink-0">{icon}</div>
            <div className="min-w-0">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">{label}</div>
                <div className="text-sm font-semibold text-slate-800 leading-relaxed truncate">{value}</div>
            </div>
        </div>
    );
}
