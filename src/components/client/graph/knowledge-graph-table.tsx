"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck } from "lucide-react";

interface KnowledgeGraphTableProps {
    nodes: any[];
    activeDirectorPersonIds?: string[];
    activePSCNodeIds?: string[];
    showTypes?: string[];
    activeOnly?: boolean;
    onNodeClick?: (node: any) => void;
}

const NODE_STYLE: Record<string, { icon: string; badge: string; label: string }> = {
    PERSON:        { icon: '👤', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',     label: 'Person' },
    LEGAL_ENTITY:  { icon: '🏢', badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', label: 'Company' },
    ADDRESS:       { icon: '📍', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Address' },
};

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
    REGISTRATION_AUTHORITY: { label: 'Registry',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    GLEIF:                  { label: 'GLEIF',        color: 'text-blue-700 bg-blue-50 border-blue-200' },
    USER_INPUT:             { label: 'User Input',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
    SYSTEM_DERIVED:         { label: 'System',       color: 'text-slate-600 bg-slate-50 border-slate-200' },
    UNKNOWN:                { label: 'Unknown',      color: 'text-slate-400 bg-slate-50 border-slate-100' },
};

export function KnowledgeGraphTable({ nodes, activeDirectorPersonIds = [], activePSCNodeIds = [], showTypes, activeOnly, onNodeClick }: KnowledgeGraphTableProps) {
    if (nodes.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-slate-200 p-16 text-center">
                <p className="text-slate-500 text-sm">No nodes match the current filter.</p>
                <p className="text-slate-400 text-xs mt-1">Try selecting a different filter above.</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="w-[130px] font-semibold text-slate-600 text-xs">Type</TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs">Name / Identifier</TableHead>
                        <TableHead className="w-[130px] font-semibold text-slate-600 text-xs">Source</TableHead>
                        <TableHead className="w-[120px] font-semibold text-slate-600 text-xs">Added</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...nodes].sort((a, b) => {
                        const typeOrder: Record<string, number> = { PERSON: 0, LEGAL_ENTITY: 1, ADDRESS: 2 };
                        const orderA = typeOrder[a.nodeType] ?? 99;
                        const orderB = typeOrder[b.nodeType] ?? 99;
                        if (orderA !== orderB) return orderA - orderB;
                        
                        // Fallback sort by name if type is the same
                        const getLabel = (n: any) => {
                            if (n.nodeType === 'PERSON') return [n.person?.firstName, n.person?.lastName].filter(Boolean).join(' ');
                            if (n.nodeType === 'LEGAL_ENTITY') return n.legalEntity?.name || '';
                            if (n.nodeType === 'ADDRESS') return n.address?.line1 || '';
                            return '';
                        };
                        return getLabel(a).localeCompare(getLabel(b));
                    }).map((node) => {
                        const style = NODE_STYLE[node.nodeType] || { icon: '⚪', badge: '', label: node.nodeType };
                        const sourceInfo = SOURCE_LABEL[node.source] || SOURCE_LABEL.UNKNOWN;
                        const isActiveDirector = node.nodeType === 'PERSON' &&
                            node.personId && activeDirectorPersonIds.includes(node.personId);
                        const isActivePSC = node.nodeType === 'PERSON' && activePSCNodeIds.includes(node.id);
                        const specialPerson = isActiveDirector || isActivePSC;

                        let label = 'Unknown';
                        if (node.nodeType === 'PERSON') {
                            label = [node.person?.firstName, node.person?.middleName, node.person?.lastName]
                                .filter(Boolean).join(' ') || 'Unknown Person';
                        } else if (node.nodeType === 'LEGAL_ENTITY') {
                            label = node.legalEntity?.name || node.legalEntity?.localRegistrationNumber || 'Unknown Entity';
                        } else if (node.nodeType === 'ADDRESS') {
                            label = [node.address?.line1, node.address?.city, node.address?.postalCode, node.address?.country]
                                .filter(Boolean).join(', ') || 'Unknown Address';
                        }

                        return (
                            <TableRow
                                key={node.id}
                                className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                                onClick={() => onNodeClick && onNodeClick(node)}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={`${style.badge} text-[10px] px-1.5 py-0 font-medium`}>
                                            {style.icon} {style.label}
                                        </Badge>
                                        {isActiveDirector && (
                                            <span title="Active Director">
                                                <Star className="h-3 w-3 text-amber-500 fill-amber-400" aria-label="Active Director" />
                                            </span>
                                        )}
                                        {isActivePSC && !isActiveDirector && (
                                            <span title="Person with Significant Control">
                                                <ShieldCheck className="h-3 w-3 text-purple-500 fill-purple-100" aria-label="PSC" />
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium text-slate-800 group-hover:text-indigo-700 transition-colors text-sm">
                                    {label}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`${sourceInfo.color} text-[10px] px-1.5 py-0`}>
                                        {sourceInfo.label}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-slate-400">
                                    {new Date(node.createdAt).toLocaleDateString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400">
                Showing {nodes.length} node{nodes.length !== 1 ? 's' : ''}
                {activeOnly && <span className="ml-1">— active people only</span>}
            </div>
        </div>
    );
}
