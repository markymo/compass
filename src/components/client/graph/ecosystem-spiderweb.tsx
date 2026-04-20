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
}

export function EcosystemSpiderweb({ leName, nodes, claims = [] }: EcosystemSpiderwebProps) {
    // Generate intelligent topological mapping
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

        // 2. Identify explicit Edge bindings
        const personToAddress = new Map<string, string[]>();
        const leToAddress = new Map<string, string[]>();
        
        claims.forEach(c => {
            if (c.subjectPersonId && c.valueAddressId) {
                if (!personToAddress.has(c.subjectPersonId)) personToAddress.set(c.subjectPersonId, []);
                personToAddress.get(c.subjectPersonId)!.push(c.valueAddressId);
            }
        });

        // 3. Categorize Nodes for Rings
        const tier1Nodes = nodes.filter(n => n.nodeType === 'PERSON' || n.nodeType === 'LEGAL_ENTITY');
        const tier2Nodes = nodes.filter(n => n.nodeType === 'ADDRESS');

        // Layout Config
        const MIN_ARC_LENGTH = 160; 
        
        // Tier 1 (People & Entities) Ring
        const t1Circumference = Math.max(800, tier1Nodes.length * MIN_ARC_LENGTH);
        const t1Radius = t1Circumference / (2 * Math.PI);

        // Tier 2 (Addresses) Ring
        const t2Circumference = Math.max(1200, tier2Nodes.length * MIN_ARC_LENGTH);
        const t2Radius = t1Radius + 250;

        // Space Tier 1 nodes
        tier1Nodes.forEach((node, idx) => {
            const angle = (idx / (tier1Nodes.length || 1)) * 2 * Math.PI;
            const x = t1Radius * Math.cos(angle);
            const y = t1Radius * Math.sin(angle);

            let label = "Unknown";
            let icon = "⚪";
            let bgColor = "#f8fafc";
            let borderColor = "#cbd5e1";

            if (node.nodeType === 'PERSON') {
                icon = "👤";
                label = node.person?.firstName ? `${node.person.firstName} ${node.person.lastName || ''}` : "Unknown Person";
                bgColor = "#ecfeff";
                borderColor = "#22d3ee"; // Brighter border
            } else {
                icon = "🏢";
                label = node.legalEntity?.name || "Unknown Entity";
                bgColor = "#fdf4ff";
                borderColor = "#e879f9";
            }

            rfNodes.push({
                id: node.id,
                position: { x, y },
                data: { label: `${icon} ${label}` },
                style: { backgroundColor: bgColor, border: `2px solid ${borderColor}`, borderRadius: '6px', fontSize: '12px', padding: '8px' }
            });

            // Connect to root!
            rfEdges.push({
                id: `e-${rootId}-${node.id}`,
                source: rootId,
                target: node.id,
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            });
        });

        // Space Tier 2 nodes (Addresses)
        tier2Nodes.forEach((node, idx) => {
            const angle = (idx / (tier2Nodes.length || 1)) * 2 * Math.PI;
            const x = t2Radius * Math.cos(angle);
            const y = t2Radius * Math.sin(angle);

            const icon = "📍";
            const label = node.address?.city || node.address?.country || "Address";
            const bgColor = "#fff7ed";
            const borderColor = "#fb923c";

            rfNodes.push({
                id: node.id,
                position: { x, y },
                data: { label: `${icon} ${label}` },
                style: { backgroundColor: bgColor, border: `2px solid ${borderColor}`, borderRadius: '6px', fontSize: '12px', padding: '6px' }
            });

            // Find who owns this address. If no one explicitly, tie to root
            let isOrphan = true;
            
            // Check person linkages
            // Map over personToAddress map
            for (const [personId, addressesOffPerson] of personToAddress.entries()) {
                if (addressesOffPerson.includes(node.addressId)) {
                    // Find the node corresponding to this personId
                    const personNode = tier1Nodes.find(n => n.personId === personId);
                    if (personNode) {
                        rfEdges.push({
                            id: `e-${personNode.id}-${node.id}`,
                            source: personNode.id,
                            target: node.id,
                            style: { stroke: '#64748b', strokeWidth: 1 },
                        });
                        isOrphan = false;
                    }
                }
            }

            if (isOrphan) {
                rfEdges.push({
                    id: `e-${rootId}-${node.id}`,
                    source: rootId,
                    target: node.id,
                    style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' },
                });
            }
        });

        return { nodes: rfNodes, edges: rfEdges };
    }, [leName, nodes, claims]);

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
