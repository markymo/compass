"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network, Table as TableIcon, Users, Building2, MapPin, ShieldCheck, Star, LayoutList } from "lucide-react";
import { KnowledgeGraphTable } from "./knowledge-graph-table";
import { EcosystemSpiderweb } from "./ecosystem-spiderweb";
import { KnowledgeGraphExplorer } from "./knowledge-graph-explorer";
import { GraphNodePanel } from "./graph-node-panel";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NodeCreateDialog } from "./node-create-dialog";
import { Plus } from "lucide-react";

type ViewMode  = 'grid' | 'spiderweb' | 'explorer';
type NodeFilter = 'all' | 'directors' | 'psc';

interface KnowledgeGraphViewProps {
    leId: string;
    leName: string;
    initialNodes: any[];
    claims: any[];
    graphEdges?: any[];
    rootLegalEntityId?: string | null;
    /** Map of edgeType -> personId[] derived from active ClientLEGraphEdge records.
     *  Replaces the old hardcoded activeDirectorPersonIds prop. */
    personIdsByEdgeType?: Record<string, string[]>;
}

export function KnowledgeGraphView({
    leId, leName, initialNodes, claims, graphEdges = [], rootLegalEntityId,
    personIdsByEdgeType = {}
}: KnowledgeGraphViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const viewMode     = (searchParams.get('view')   ?? 'grid') as ViewMode;
    const nodeFilter   = (searchParams.get('filter') ?? 'all')  as NodeFilter;
    const showAddresses = (searchParams.get('addr')  ?? '1') === '1';

    const [selectedNode, setSelectedNode] = useState<any | null>(null);
    const [createNodeType, setCreateNodeType] = useState<"PERSON" | "LEGAL_ENTITY" | "ADDRESS" | null>(null);

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Derived ID sets
    const pscNodeIds = useMemo(
        () => new Set(graphEdges.filter(e => e.edgeType === 'PSC_CONTROL').map(e => e.fromNodeId)),
        [graphEdges]
    );
    const activePSCNodeIds = useMemo(
        () => new Set(graphEdges.filter(e => e.edgeType === 'PSC_CONTROL' && e.isActive).map(e => e.fromNodeId)),
        [graphEdges]
    );

    // Derive director IDs from the generic edge-type map
    const activeDirectorPersonIds = personIdsByEdgeType['DIRECTOR'] ?? [];

    const filteredNodes = useMemo(() => {
        let base = initialNodes;

        if (nodeFilter === 'directors') {
            base = base.filter(n =>
                n.nodeType === 'PERSON' && n.personId && activeDirectorPersonIds.includes(n.personId)
            );
        } else if (nodeFilter === 'psc') {
            base = base.filter(n => pscNodeIds.has(n.id));
        }

        if (!showAddresses) {
            base = base.filter(n => n.nodeType !== 'ADDRESS');
        }

        return base;
    }, [initialNodes, nodeFilter, showAddresses, pscNodeIds, activeDirectorPersonIds]);

    // Counts for badge labels
    const counts = useMemo(() => {
        const pscNodes = initialNodes.filter(n => pscNodeIds.has(n.id));
        const dirNodes = initialNodes.filter(n =>
            n.nodeType === 'PERSON' && n.personId && activeDirectorPersonIds.includes(n.personId)
        );
        return {
            all: initialNodes.filter(n => n.nodeType !== 'ADDRESS').length,
            directors: dirNodes.length,
            psc: pscNodes.length,
            addresses: initialNodes.filter(n => n.nodeType === 'ADDRESS').length,
        };
    }, [initialNodes, pscNodeIds, activeDirectorPersonIds]);

    const FILTER_OPTIONS: { key: NodeFilter; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'all',       label: 'All',              icon: <Network className="h-3 w-3" />,      count: counts.all },
        { key: 'directors', label: 'Active Directors', icon: <Star className="h-3 w-3" />,         count: counts.directors },
        { key: 'psc',       label: 'PSC',              icon: <ShieldCheck className="h-3 w-3" />,  count: counts.psc },
    ];

    const pscOnly = nodeFilter === 'psc';

    return (
        <Card className="w-full shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl pb-3">

                {/* Row 1: Title + View Toggle */}
                <div className="flex items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Network className="h-5 w-5 text-indigo-500" />
                            Knowledge Graph
                        </CardTitle>
                        <CardDescription className="mt-0.5">
                            {filteredNodes.length} of {initialNodes.length} nodes shown — {leName}
                        </CardDescription>
                    </div>

                    {/* View toggle */}
                    <div className="flex bg-white rounded-md shadow-sm border border-slate-200 p-0.5">
                        <Button variant="ghost" size="sm"
                            onClick={() => setParam('view', 'grid')}
                            className={`h-8 px-3 text-xs ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <TableIcon className="h-3.5 w-3.5 mr-1.5" />Data Grid
                        </Button>
                        <Button variant="ghost" size="sm"
                            onClick={() => setParam('view', 'spiderweb')}
                            className={`h-8 px-3 text-xs ${viewMode === 'spiderweb' ? 'bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Network className="h-3.5 w-3.5 mr-1.5" />Spiderweb
                        </Button>
                        <Button variant="ghost" size="sm"
                            onClick={() => setParam('view', 'explorer')}
                            className={`h-8 px-3 text-xs ${viewMode === 'explorer' ? 'bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutList className="h-3.5 w-3.5 mr-1.5" />Explorer
                        </Button>
                    </div>
                </div>

                {/* Row 2: Radio filter group + Address toggle */}
                <div className="flex items-center justify-between">
                    {/* Radio set */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm gap-0.5">
                        {FILTER_OPTIONS.map((opt, i) => {
                            const isActive = nodeFilter === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setParam('filter', opt.key)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        isActive
                                            ? opt.key === 'all'
                                                ? 'bg-slate-800 text-white shadow-sm'
                                                : opt.key === 'directors'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'bg-purple-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {opt.icon}
                                    {opt.label}
                                    <span className={`ml-0.5 px-1.5 py-0 rounded-full text-[10px] leading-4 font-semibold ${
                                        isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {opt.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Address toggle + Add Node — always independent */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setParam('addr', showAddresses ? '0' : '1')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                showAddresses
                                    ? 'bg-orange-50 text-orange-700 border-orange-300 shadow-sm hover:bg-orange-100'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                            }`}
                        >
                            <MapPin className="h-3 w-3" />
                            {showAddresses ? 'Addresses shown' : 'Addresses hidden'}
                            <span className={`px-1.5 rounded-full text-[10px] leading-4 font-semibold ${showAddresses ? 'bg-orange-200/60 text-orange-800' : 'bg-slate-100 text-slate-400'}`}>
                                {counts.addresses}
                            </span>
                        </button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Add Node
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setCreateNodeType("PERSON")}>
                                    <Users className="h-4 w-4 mr-2 text-cyan-600" />
                                    Add Person
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setCreateNodeType("LEGAL_ENTITY")}>
                                    <Building2 className="h-4 w-4 mr-2 text-fuchsia-600" />
                                    Add Company
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setCreateNodeType("ADDRESS")}>
                                    <MapPin className="h-4 w-4 mr-2 text-orange-600" />
                                    Add Address
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {viewMode === 'grid' && (
                    <div className="p-6">
                        <KnowledgeGraphTable
                            nodes={filteredNodes}
                            activeDirectorPersonIds={activeDirectorPersonIds}
                            activePSCNodeIds={[...activePSCNodeIds]}
                            activeOnly={nodeFilter === 'directors'}
                            onNodeClick={setSelectedNode}
                        />
                    </div>
                )}
                {viewMode === 'spiderweb' && (
                    <div className="h-[700px] w-full bg-slate-50/50 rounded-b-xl border-t border-slate-100">
                        <EcosystemSpiderweb
                            leName={leName}
                            nodes={filteredNodes}
                            claims={claims}
                            graphEdges={graphEdges}
                            rootLegalEntityId={rootLegalEntityId}
                            activeDirectorPersonIds={activeDirectorPersonIds}
                            showAllNodes={nodeFilter === 'all'}
                            pscOnly={pscOnly}
                        />
                    </div>
                )}
                {viewMode === 'explorer' && (
                    <div className="p-6">
                        <KnowledgeGraphExplorer
                            leName={leName}
                            nodes={filteredNodes}
                            claims={claims}
                            graphEdges={graphEdges}
                            rootLegalEntityId={rootLegalEntityId}
                            personIdsByEdgeType={personIdsByEdgeType}
                            activePSCNodeIds={[...activePSCNodeIds]}
                        />
                    </div>
                )}
            </CardContent>

            <GraphNodePanel
                open={!!selectedNode}
                onOpenChange={(open) => !open && setSelectedNode(null)}
                node={selectedNode}
                clientLEId={leId}
                graphEdges={graphEdges}
                allNodes={initialNodes}
                onNodeUpdated={() => {
                    // Triggers a router refresh to fetch new data from the server
                    router.refresh();
                }}
            />

            {createNodeType && (
                <NodeCreateDialog
                    open={!!createNodeType}
                    onOpenChange={(open) => !open && setCreateNodeType(null)}
                    clientLEId={leId}
                    nodeType={createNodeType}
                    onSuccess={() => {
                        setCreateNodeType(null);
                        router.refresh();
                    }}
                />
            )}
        </Card>
    );
}
