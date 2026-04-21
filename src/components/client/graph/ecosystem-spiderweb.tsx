"use client";

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface EcosystemSpiderwebProps {
    leName: string;
    nodes: any[];
    claims?: any[];
    rootLegalEntityId?: string | null;
    activeDirectorPersonIds?: string[];
    showAllNodes?: boolean;
}

export function EcosystemSpiderweb({ leName, nodes, claims = [], rootLegalEntityId, activeDirectorPersonIds = [], showAllNodes = true }: EcosystemSpiderwebProps) {
    const initialNetwork = useMemo(() => {
        const rootId = 'root-le';

        const rfNodes: any[] = [];
        const rfEdges: any[] = [];

        // 1. Root Node
        rfNodes.push({
            id: rootId,
            position: { x: 0, y: 0 },
            data: { label: `🏢 ${leName}` },
            style: { backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px', border: '2px solid #94a3b8' }
        });

        // 2. Build a lookup: addressId → Set<parentGraphNodeId>
        //    Supports multi-parent: one address can belong to many persons AND the LE
        //    Parent resolution priority:
        //      - subjectPersonId → find the graph node for that person
        //      - subjectLeId === rootLegalEntityId → parent is the root ('root-le')
        //      - subjectLeId !== rootLegalEntityId → find the related LE graph node

        // Index graph nodes for fast lookup
        const personNodeByPersonId = new Map<string, string>(); // personId → graphNode.id
        const leNodeByLeId = new Map<string, string>();          // legalEntityId → graphNode.id
        
        nodes.forEach(n => {
            if (n.nodeType === 'PERSON' && n.personId) personNodeByPersonId.set(n.personId, n.id);
            if (n.nodeType === 'LEGAL_ENTITY' && n.legalEntityId) leNodeByLeId.set(n.legalEntityId, n.id);
        });

        // Build addressParents map
        const addressParents = new Map<string, Set<string>>(); // addressId → Set<parentNodeId>
        const addAddressParent = (addressId: string, parentNodeId: string) => {
            if (!addressParents.has(addressId)) addressParents.set(addressId, new Set());
            addressParents.get(addressId)!.add(parentNodeId);
        };

        claims.forEach(c => {
            if (!c.valueAddressId) return;
            
            if (c.subjectPersonId) {
                const personNodeId = personNodeByPersonId.get(c.subjectPersonId);
                if (personNodeId) addAddressParent(c.valueAddressId, personNodeId);
            }
            
            if (c.subjectLeId) {
                if (c.subjectLeId === rootLegalEntityId) {
                    // Address directly belongs to the root LE
                    addAddressParent(c.valueAddressId, rootId);
                } else {
                    // Address belongs to a related company in the graph
                    const relatedLeNodeId = leNodeByLeId.get(c.subjectLeId);
                    if (relatedLeNodeId) addAddressParent(c.valueAddressId, relatedLeNodeId);
                }
            }
        });

        // 3. Categorize nodes into rings
        const tier1Nodes = nodes.filter(n => n.nodeType === 'PERSON' || n.nodeType === 'LEGAL_ENTITY');
        const tier2Nodes = nodes.filter(n => n.nodeType === 'ADDRESS');

        // Dynamic radius based on node count (min arc gap = 160px)
        const MIN_ARC_LENGTH = 160;
        const t1Radius = Math.max(800, tier1Nodes.length * MIN_ARC_LENGTH) / (2 * Math.PI);
        const t2Radius = t1Radius + 250;

        // 4. Place Tier 1 nodes (People & Related Entities) on inner ring
        tier1Nodes.forEach((node, idx) => {
            const angle = (idx / (tier1Nodes.length || 1)) * 2 * Math.PI;
            const x = t1Radius * Math.cos(angle);
            const y = t1Radius * Math.sin(angle);

            let label = 'Unknown';
            let icon = '⚪';
            let bgColor = '#f8fafc';
            let borderColor = '#cbd5e1';

            if (node.nodeType === 'PERSON') {
                icon = '👤';
                label = node.person?.firstName
                    ? `${node.person.firstName} ${node.person.lastName || ''}`.trim()
                    : 'Unknown Person';
                const isActiveDirector = node.personId && activeDirectorPersonIds.includes(node.personId);
                bgColor = isActiveDirector ? '#fffbeb' : '#ecfeff';
                borderColor = isActiveDirector ? '#f59e0b' : '#22d3ee'; // gold for active directors
            } else {
                icon = '🏢';
                label = node.legalEntity?.name || 'Unknown Entity';
                bgColor = '#fdf4ff';
                borderColor = '#e879f9';
            }

            rfNodes.push({
                id: node.id,
                position: { x, y },
                data: { label: `${icon} ${label}` },
                style: { backgroundColor: bgColor, border: `2px solid ${borderColor}`, borderRadius: '6px', fontSize: '12px', padding: '8px' }
            });

            // Edge: Root → Tier1 node
            rfEdges.push({
                id: `e-${rootId}-${node.id}`,
                source: rootId,
                target: node.id,
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            });
        });

        // 5. Place Tier 2 nodes (Addresses) on outer ring, draw ALL parent edges
        tier2Nodes.forEach((node, idx) => {
            const angle = (idx / (tier2Nodes.length || 1)) * 2 * Math.PI;
            const x = t2Radius * Math.cos(angle);
            const y = t2Radius * Math.sin(angle);

            const label = [node.address?.line1, node.address?.city, node.address?.country]
                .filter(Boolean).join(', ') || node.address?.city || node.address?.country || 'Address';

            rfNodes.push({
                id: node.id,
                position: { x, y },
                data: { label: `📍 ${label}` },
                style: { backgroundColor: '#fff7ed', border: `2px solid #fb923c`, borderRadius: '6px', fontSize: '11px', padding: '6px', maxWidth: '160px' }
            });

            const parents = addressParents.get(node.addressId);
            
            if (parents && parents.size > 0) {
                // Draw one edge per parent (multi-parent support)
                let edgeIdx = 0;
                parents.forEach(parentNodeId => {
                    rfEdges.push({
                        id: `e-addr-${node.id}-${parentNodeId}-${edgeIdx++}`,
                        source: parentNodeId,
                        target: node.id,
                        style: {
                            stroke: parentNodeId === rootId ? '#fb923c' : '#64748b',
                            strokeWidth: 1.5,
                        },
                        label: parents.size > 1 ? `${parents.size} owners` : undefined,
                    });
                });
            } else {
                // Orphan — no claim linkage found, dashed fallback to root
                rfEdges.push({
                    id: `e-orphan-${node.id}`,
                    source: rootId,
                    target: node.id,
                    style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' },
                });
            }
        });

        return { nodes: rfNodes, edges: rfEdges };
    }, [leName, nodes, claims, rootLegalEntityId, activeDirectorPersonIds]);

    const [rfNodes, setNodes, onNodesChange] = useNodesState(initialNetwork.nodes);
    const [rfEdges, setEdges, onEdgesChange] = useEdgesState(initialNetwork.edges);

    return (
        <div className="w-full h-full relative" style={{ minHeight: '650px' }}>
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-right"
            >
                <Controls />
                <MiniMap 
                    nodeColor={(n) => {
                        if (n.id === 'root-le') return '#94a3b8';
                        return '#e2e8f0';
                    }}
                    maskColor="rgba(248, 250, 252, 0.7)"
                />
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
            </ReactFlow>
        </div>
    );
}
