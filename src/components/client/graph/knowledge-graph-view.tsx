"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Network, Table as TableIcon, Users, Building2, MapPin, Star, LayoutGrid } from "lucide-react";
import { KnowledgeGraphTable } from "./knowledge-graph-table";
import { EcosystemSpiderweb } from "./ecosystem-spiderweb";

type NodeTypeFilter = 'all' | 'people' | 'companies' | 'addresses' | 'active-directors';
type ViewMode = 'grid' | 'spiderweb';

interface KnowledgeGraphViewProps {
    leId: string;
    leName: string;
    initialNodes: any[];
    claims: any[];
    rootLegalEntityId?: string | null;
    activeDirectorPersonIds?: string[];
}

const TYPE_FILTERS: { key: NodeTypeFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'all',              label: 'All',              icon: <LayoutGrid className="h-3 w-3" />,  color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
    { key: 'active-directors', label: 'Active Directors', icon: <Star className="h-3 w-3" />,        color: 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' },
    { key: 'people',           label: 'People',           icon: <Users className="h-3 w-3" />,       color: 'bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100' },
    { key: 'companies',        label: 'Companies',        icon: <Building2 className="h-3 w-3" />,   color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-100' },
    { key: 'addresses',        label: 'Addresses',        icon: <MapPin className="h-3 w-3" />,      color: 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100' },
];

export function KnowledgeGraphView({ leId, leName, initialNodes, claims, rootLegalEntityId, activeDirectorPersonIds = [] }: KnowledgeGraphViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const viewMode: ViewMode = (searchParams.get('view') as ViewMode) || 'grid';
    const typeFilter: NodeTypeFilter = (searchParams.get('type') as NodeTypeFilter) || 'all';

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    const filteredNodes = useMemo(() => {
        switch (typeFilter) {
            case 'people':
                return initialNodes.filter(n => n.nodeType === 'PERSON');
            case 'companies':
                return initialNodes.filter(n => n.nodeType === 'LEGAL_ENTITY');
            case 'addresses':
                return initialNodes.filter(n => n.nodeType === 'ADDRESS');
            case 'active-directors':
                return initialNodes.filter(n =>
                    n.nodeType === 'PERSON' && n.personId && activeDirectorPersonIds.includes(n.personId)
                );
            default:
                return initialNodes;
        }
    }, [initialNodes, typeFilter, activeDirectorPersonIds]);

    const nodeTypeCounts = useMemo(() => ({
        all: initialNodes.length,
        people: initialNodes.filter(n => n.nodeType === 'PERSON').length,
        companies: initialNodes.filter(n => n.nodeType === 'LEGAL_ENTITY').length,
        addresses: initialNodes.filter(n => n.nodeType === 'ADDRESS').length,
        'active-directors': initialNodes.filter(n =>
            n.nodeType === 'PERSON' && n.personId && activeDirectorPersonIds.includes(n.personId)
        ).length,
    }), [initialNodes, activeDirectorPersonIds]);

    return (
        <Card className="w-full shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl pb-3">
                {/* Row 1: Title + View Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Network className="h-5 w-5 text-indigo-500" />
                            Knowledge Graph
                        </CardTitle>
                        <CardDescription className="mt-0.5">
                            {initialNodes.length} nodes in ecosystem for {leName}
                        </CardDescription>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex bg-white rounded-md shadow-sm border border-slate-200 p-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setParam('view', 'grid')}
                            className={`h-8 px-3 text-xs ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <TableIcon className="h-3.5 w-3.5 mr-1.5" />
                            Data Grid
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setParam('view', 'spiderweb')}
                            className={`h-8 px-3 text-xs ${viewMode === 'spiderweb' ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <Network className="h-3.5 w-3.5 mr-1.5" />
                            Spiderweb
                        </Button>
                    </div>
                </div>

                {/* Row 2: Filter Chips */}
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-medium mr-1">Filter:</span>
                    {TYPE_FILTERS.map(f => {
                        const isActive = typeFilter === f.key;
                        const count = nodeTypeCounts[f.key];
                        return (
                            <button
                                key={f.key}
                                onClick={() => setParam('type', f.key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                                    ${isActive
                                        ? f.color.replace('hover:', '') + ' ring-2 ring-offset-1 ring-indigo-300 shadow-sm'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                    }`}
                            >
                                {f.icon}
                                {f.label}
                                <span className={`ml-0.5 px-1 py-0 rounded text-[10px] leading-4 ${isActive ? 'bg-white/60' : 'bg-slate-100'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {viewMode === 'grid' ? (
                    <div className="p-6">
                        <KnowledgeGraphTable
                            nodes={filteredNodes}
                            activeFilter={typeFilter}
                            activeDirectorPersonIds={activeDirectorPersonIds}
                        />
                    </div>
                ) : (
                    <div className="h-[700px] w-full bg-slate-50/50 rounded-b-xl border-t border-slate-100">
                        <EcosystemSpiderweb
                            leName={leName}
                            nodes={filteredNodes}
                            claims={claims}
                            rootLegalEntityId={rootLegalEntityId}
                            activeDirectorPersonIds={activeDirectorPersonIds}
                            showAllNodes={typeFilter === 'all'}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
