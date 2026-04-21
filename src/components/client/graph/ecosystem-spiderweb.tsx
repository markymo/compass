"use client";

import { useMemo, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Canvas-based — must be client-only
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-400 text-sm animate-pulse">Rendering graph...</div>
        </div>
    )
});

interface EcosystemSpiderwebProps {
    leName: string;
    nodes: any[];
    claims?: any[];
    graphEdges?: any[];   // Typed relationship edges (PSC, DIRECTOR, etc.)
    rootLegalEntityId?: string | null;
    activeDirectorPersonIds?: string[];
    showAllNodes?: boolean;
    pscOnly?: boolean;    // When true, only PSC edges are rendered
}

// Visual style config per node type
const STYLE = {
    ROOT:          { bg: '#1e293b', border: '#475569', text: '#f8fafc', size: 14, icon: '🏢' },
    PERSON:        { bg: '#ecfeff', border: '#22d3ee', text: '#0e7490', size: 9,  icon: '👤' },
    PERSON_ACTIVE: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', size: 10, icon: '⭐' },
    LEGAL_ENTITY:  { bg: '#fdf4ff', border: '#d946ef', text: '#86198f', size: 9,  icon: '🏢' },
    ADDRESS:       { bg: '#fff7ed', border: '#fb923c', text: '#9a3412', size: 6,  icon: '📍' },
} as const;

type StyleKey = keyof typeof STYLE;

export function EcosystemSpiderweb({
    leName,
    nodes,
    claims = [],
    graphEdges = [],
    rootLegalEntityId,
    activeDirectorPersonIds = [],
    showAllNodes = true,
    pscOnly = false,
}: EcosystemSpiderwebProps) {
    const fgRef = useRef<any>(null);

    // Build force-graph data from our graph nodes + claims
    const graphData = useMemo(() => {
        const gNodes: any[] = [];
        const gLinks: any[] = [];

        // Index graph nodes for O(1) parent lookup
        const personNodeByPersonId = new Map<string, string>();
        const leNodeByLeId = new Map<string, string>();
        nodes.forEach(n => {
            if (n.nodeType === 'PERSON' && n.personId) personNodeByPersonId.set(n.personId, n.id);
            if (n.nodeType === 'LEGAL_ENTITY' && n.legalEntityId) leNodeByLeId.set(n.legalEntityId, n.id);
        });

        // Build address → Set<parentNodeId> from claims
        const addressParents = new Map<string, Set<string>>();
        const addParent = (addressId: string, parentId: string) => {
            if (!addressParents.has(addressId)) addressParents.set(addressId, new Set());
            addressParents.get(addressId)!.add(parentId);
        };
        claims.forEach(c => {
            if (!c.valueAddressId) return;
            if (c.subjectPersonId) {
                const pid = personNodeByPersonId.get(c.subjectPersonId);
                if (pid) addParent(c.valueAddressId, pid);
            }
            if (c.subjectLeId) {
                if (c.subjectLeId === rootLegalEntityId) {
                    addParent(c.valueAddressId, 'root-le');
                } else {
                    const lid = leNodeByLeId.get(c.subjectLeId);
                    if (lid) addParent(c.valueAddressId, lid);
                }
            }
        });

        // Root node — pinned at center
        gNodes.push({
            id: 'root-le',
            label: leName,
            styleKey: 'ROOT' as StyleKey,
            fx: 0, fy: 0, // Pin root at center
        });

        // Populate graph nodes
        nodes.forEach(n => {
            const isActiveDir = n.nodeType === 'PERSON' && n.personId && activeDirectorPersonIds.includes(n.personId);

            let label = 'Unknown';
            let styleKey: StyleKey = 'PERSON';

            if (n.nodeType === 'PERSON') {
                label = [n.person?.firstName, n.person?.lastName].filter(Boolean).join(' ') || 'Unknown Person';
                styleKey = isActiveDir ? 'PERSON_ACTIVE' : 'PERSON';
            } else if (n.nodeType === 'LEGAL_ENTITY') {
                label = n.legalEntity?.name || 'Unknown Entity';
                styleKey = 'LEGAL_ENTITY';
            } else if (n.nodeType === 'ADDRESS') {
                label = [n.address?.line1, n.address?.city, n.address?.postalCode]
                    .filter(Boolean).join(', ') || 'Address';
                styleKey = 'ADDRESS';
            }

            gNodes.push({
                id: n.id,
                label,
                styleKey,
                addressId: n.addressId,
                personId: n.personId,
            });
        });

        // Links: tier-1 nodes → root (skip in pscOnly mode, and skip PSC nodes which get their own typed edge)
        if (!pscOnly) {
            nodes.filter(n => n.nodeType !== 'ADDRESS').forEach(n => {
                const hasPSCEdge = graphEdges.some(e => e.fromNodeId === n.id && e.edgeType === 'PSC_CONTROL');
                if (!hasPSCEdge) {
                    gLinks.push({
                        source: 'root-le',
                        target: n.id,
                        linkType: 'ECOSYSTEM',
                        curvature: 0,
                    });
                }
            });
        }

        // PSC_CONTROL typed edges from graph edge table — rendered in purple
        graphEdges.forEach(edge => {
            // fromNodeId references a ClientLEGraphNode; we need its graph node's graph-node-id
            const fromNodeExists = nodes.find(n => n.id === edge.fromNodeId);
            if (!fromNodeExists) return; // node not in current filtered view, skip

            // Summarise the natures_of_control into a short label
            const controls: string[] = edge.naturesOfControl || [];
            const controlLabel = controls
                .map((c: string) => {
                    if (c.includes('ownership-of-shares')) return c.match(/(\d+-to-\d+)/)?.[1]?.replace(/-to-/, '–') + '% shares';
                    if (c.includes('voting-rights')) return 'voting';
                    if (c.includes('right-to-appoint')) return 'appoint directors';
                    if (c.includes('significant-influence')) return 'influence';
                    return c;
                })
                .slice(0, 2)
                .join(', ');

            gLinks.push({
                source: edge.fromNodeId,
                target: 'root-le',
                linkType: edge.isActive ? 'PSC_ACTIVE' : 'PSC_CEASED',
                curvature: 0.2,
                label: controlLabel || 'PSC',
            });
        });

        // Links: addresses → their parents (multi-parent supported)
        nodes.filter(n => n.nodeType === 'ADDRESS').forEach(n => {
            const parents = addressParents.get(n.addressId);
            if (parents && parents.size > 0) {
                let i = 0;
                parents.forEach(parentId => {
                    gLinks.push({
                        source: parentId,
                        target: n.id,
                        linkType: 'ADDRESS',
                        // Slight curvature when same address has multiple owners gives visual separation
                        curvature: parents.size > 1 ? (i++ % 2 === 0 ? 0.15 : -0.15) : 0,
                    });
                });
            } else {
                // Orphan — dashed treatment via low opacity
                gLinks.push({
                    source: 'root-le',
                    target: n.id,
                    linkType: 'ORPHAN',
                    curvature: 0,
                });
            }
        });

        return { nodes: gNodes, links: gLinks };
    }, [leName, nodes, claims, graphEdges, rootLegalEntityId, activeDirectorPersonIds]);

    // Configure d3 forces after graph initializes
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg) return;

        // Stronger repulsion to spread nodes out more naturally
        fg.d3Force('charge')?.strength(-250);

        // Tiered link distances
        fg.d3Force('link')?.distance((link: any) => {
            if (link.linkType === 'ADDRESS') return 90;
            if (link.linkType === 'ECOSYSTEM') return 160;
            return 120;
        });
    }, [graphData]);

    // Custom node drawing on canvas
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const style = STYLE[node.styleKey as StyleKey] || STYLE.PERSON;
        const r = style.size;
        const x = node.x ?? 0;
        const y = node.y ?? 0;

        // Circle background
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = style.bg;
        ctx.fill();

        // Border ring
        ctx.strokeStyle = style.border;
        ctx.lineWidth = node.styleKey === 'ROOT' ? 3 : 2;
        ctx.stroke();

        // Emoji icon (drawn as text — works on canvas)
        const iconSize = Math.max(r * 1.6, 8);
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.icon, x, y);

        // Label — only draw if zoomed in enough to read
        const minScaleForLabel = node.styleKey === 'ROOT' ? 0.1 : 0.25;
        if (globalScale >= minScaleForLabel) {
            const maxChars = node.styleKey === 'ADDRESS' ? 22 : 18;
            const rawLabel: string = node.label || '';
            const label = rawLabel.length > maxChars ? rawLabel.slice(0, maxChars - 1) + '…' : rawLabel;
            const fontSize = Math.max(node.styleKey === 'ROOT' ? 14 / globalScale : 11 / globalScale, 2);

            ctx.font = `${node.styleKey === 'ROOT' ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Label shadow for readability
            ctx.shadowColor = 'rgba(248,250,252,0.95)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = style.text;
            ctx.fillText(label, x, y + r + 3 / globalScale);
            ctx.shadowBlur = 0;
        }
    }, []);

    // Hit-test area for clicks must match drawn circle
    const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const style = STYLE[node.styleKey as StyleKey] || STYLE.PERSON;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, style.size, 0, 2 * Math.PI);
        ctx.fill();
    }, []);

    // Link colour and width
    const linkColor = useCallback((link: any) => {
        if (link.linkType === 'ECOSYSTEM') return 'rgba(148,163,184,0.6)';
        if (link.linkType === 'ADDRESS') return 'rgba(251,146,60,0.7)';
        if (link.linkType === 'PSC_ACTIVE') return 'rgba(147,51,234,0.85)';   // vivid purple
        if (link.linkType === 'PSC_CEASED') return 'rgba(167,139,250,0.4)';   // muted purple
        return 'rgba(226,232,240,0.4)'; // ORPHAN
    }, []);

    const linkWidth = useCallback((link: any) => {
        if (link.linkType === 'ECOSYSTEM') return 1.5;
        if (link.linkType === 'ADDRESS') return 1;
        if (link.linkType === 'PSC_ACTIVE') return 3;
        if (link.linkType === 'PSC_CEASED') return 1.5;
        return 0.5;
    }, []);

    const linkDash = useCallback((link: any) => {
        return link.linkType === 'ORPHAN' ? [4, 4] : null;
    }, []);

    // Zoom to fit once simulation settles
    const handleEngineStop = useCallback(() => {
        fgRef.current?.zoomToFit(600, 80);
    }, []);

    const nodeLabel = useCallback((node: any) => {
        if (node.styleKey === 'ROOT') return '';
        return node.label || '';
    }, []);

    return (
        <div className="w-full h-full relative rounded-b-xl overflow-hidden" style={{ minHeight: '700px', background: '#f8fafc' }}>
            {/* Legend */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-100 shadow-sm text-xs">
                <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wide mb-0.5">Legend</span>
                {(['PERSON_ACTIVE', 'PERSON', 'LEGAL_ENTITY', 'ADDRESS'] as StyleKey[]).map(key => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                            style={{ backgroundColor: STYLE[key].bg, borderColor: STYLE[key].border }} />
                        <span style={{ color: STYLE[key].text }} className="font-medium">
                            {STYLE[key].icon} {key === 'PERSON_ACTIVE' ? 'Active Director' : key.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                    </div>
                ))}
                {/* PSC edge legend */}
                <div className="border-t border-slate-100 mt-1 pt-1 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 rounded" style={{ backgroundColor: 'rgba(147,51,234,0.85)' }} />
                        <span className="text-purple-700 font-medium">PSC Control (active)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 rounded opacity-50" style={{ backgroundColor: 'rgba(147,51,234,0.85)' }} />
                        <span className="text-purple-400 font-medium">PSC Control (ceased)</span>
                    </div>
                </div>
            </div>

            <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeCanvasObject={nodeCanvasObject}
                nodeCanvasObjectMode={() => 'replace'}
                nodePointerAreaPaint={nodePointerAreaPaint}
                nodeLabel={nodeLabel}
                linkColor={linkColor}
                linkWidth={linkWidth}
                linkLineDash={linkDash}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={0.85}
                linkCurvature="curvature"
                backgroundColor="#f8fafc"
                cooldownTicks={120}
                onEngineStop={handleEngineStop}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.35}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                minZoom={0.1}
                maxZoom={8}
            />
        </div>
    );
}
