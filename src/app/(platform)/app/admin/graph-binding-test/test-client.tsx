"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraphNodePicker, GraphNodePickerSelection } from "@/components/client/graph/graph-node-picker";
import { upsertGraphBinding, deleteGraphBinding } from "@/actions/graph-bindings";
import { updateStandingDataProperty } from "@/actions/client-le";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    GitBranch, Database, Network, Users, Plus, Trash2, RefreshCw,
    CheckCircle, ChevronRight, AlertTriangle
} from "lucide-react";

interface Props {
    field: any;
    clientLEs: { id: string; name: string }[];
    selectedLeId: string | null;
    graphNodes: any[];
    graphEdges: any[];
    personIdsByEdgeType: Record<string, string[]>;
    fieldNo: number;
}

export function GraphBindingTestClient({
    field,
    clientLEs,
    selectedLeId,
    graphNodes,
    graphEdges,
    personIdsByEdgeType,
    fieldNo,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [lastClaim, setLastClaim] = useState<any>(null);
    const [isAssertingClaim, setIsAssertingClaim] = useState(false);

    const binding = field?.graphBindings?.[0] ?? null;

    function selectLE(leId: string) {
        router.push(`?leId=${leId}&fieldNo=${fieldNo}`);
    }

    async function handleCreateBinding() {
        if (!field) return;
        startTransition(async () => {
            const res = await upsertGraphBinding({
                fieldNo: field.fieldNo,
                graphNodeType: "PERSON",
                filterEdgeType: "DIRECTOR",
                filterActiveOnly: true,
                writeBackEdgeType: "DIRECTOR",
                writeBackIsActive: true,
                pickerLabel: "Select a Director",
                allowCreate: true,
            });
            if (res.success) {
                toast.success("Binding created ✓");
                router.refresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    async function handleDeleteBinding(id: string) {
        startTransition(async () => {
            const res = await deleteGraphBinding(id);
            if (res.success) {
                toast.success("Binding deleted");
                router.refresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    async function handleAssertClaim(item: GraphNodePickerSelection) {
        if (!selectedLeId) return;
        setIsAssertingClaim(true);
        try {
            const res = await updateStandingDataProperty(
                selectedLeId,
                String(fieldNo),
                { value: item.personId || item.legalEntityId || item.addressId, status: "ASSERTED" }
            );
            if (res.success) {
                setLastClaim({ item, result: res });
                setSelectedNodeIds(prev =>
                    prev.includes(item.nodeId) ? prev : [...prev, item.nodeId]
                );
                toast.success(`Claim asserted for "${item.displayLabel}" — check edges below after refresh`);
            } else {
                toast.error("Claim failed");
            }
        } finally {
            setIsAssertingClaim(false);
            // Refresh so the edge table updates
            setTimeout(() => router.refresh(), 800);
        }
    }

    function handleDeselect(nodeId: string) {
        setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                    <GitBranch className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Graph Binding Test Harness</h1>
                    <p className="text-sm text-slate-500">Validate Steps 1–4 of the Master Data Graph Integration</p>
                </div>
                <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Dev Only
                </Badge>
            </div>

            {/* Step 1: Field + Binding */}
            <section className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b px-6 py-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h2 className="font-semibold text-slate-800">Field Definition + Graph Binding</h2>
                    <code className="ml-auto text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">fieldNo={fieldNo}</code>
                </div>
                <div className="p-6 space-y-4">
                    {field ? (
                        <>
                            <div className="flex flex-wrap gap-3 items-center">
                                <span className="font-semibold text-slate-900">{field.fieldName}</span>
                                <Badge variant="outline">{field.appDataType}</Badge>
                                {field.isMultiValue && <Badge variant="secondary">Multi-value</Badge>}
                                <span className="text-xs text-slate-400">({field.sourceMappings?.length ?? 0} source mappings)</span>
                            </div>

                            {binding ? (
                                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                                    <CheckCircle className="h-4 w-4 text-indigo-600 flex-none" />
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">
                                        <span><span className="text-slate-500">Node type:</span> <strong>{binding.graphNodeType}</strong></span>
                                        <span><span className="text-slate-500">Filter edge:</span> <strong className="font-mono">{binding.filterEdgeType ?? "—"}</strong></span>
                                        <span><span className="text-slate-500">Write-back edge:</span> <strong className="font-mono text-emerald-700">{binding.writeBackEdgeType ?? "—"}</strong></span>
                                        <span><span className="text-slate-500">Allow create:</span> <strong>{binding.allowCreate ? "Yes" : "No"}</strong></span>
                                    </div>
                                    <Button
                                        size="sm" variant="ghost"
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7"
                                        onClick={() => handleDeleteBinding(binding.id)}
                                        disabled={isPending}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 p-3 bg-slate-50 border border-dashed rounded-lg">
                                    <span className="text-sm text-slate-500">No active binding for this field.</span>
                                    <Button size="sm" onClick={handleCreateBinding} disabled={isPending}>
                                        {isPending
                                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                                            : <Plus className="h-3.5 w-3.5 mr-1" />
                                        }
                                        Create DIRECTOR binding for field {fieldNo}
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-red-500">Field {fieldNo} not found.</p>
                    )}
                </div>
            </section>

            {/* Step 2: Select LE */}
            <section className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b px-6 py-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <h2 className="font-semibold text-slate-800">Select a Legal Entity</h2>
                    {selectedLeId && (
                        <span className="ml-auto text-xs text-slate-400 font-mono">
                            {clientLEs.find(l => l.id === selectedLeId)?.name}
                        </span>
                    )}
                </div>
                <div className="p-6">
                    <div className="flex flex-wrap gap-2">
                        {clientLEs.map(le => (
                            <button
                                key={le.id}
                                onClick={() => selectLE(le.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                    selectedLeId === le.id
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                                }`}
                            >
                                {le.name}
                            </button>
                        ))}
                    </div>
                    {selectedLeId && (
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-2xl font-bold text-slate-900">{graphNodes.filter(n => n.nodeType === 'PERSON').length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Person nodes</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-2xl font-bold text-slate-900">{graphNodes.filter(n => n.nodeType === 'LEGAL_ENTITY').length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Entity nodes</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-2xl font-bold text-slate-900">{graphEdges.length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Edges</p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Step 3: GraphNodePicker */}
            {selectedLeId && binding && (
                <section className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b px-6 py-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                        <h2 className="font-semibold text-slate-800">GraphNodePicker — try selecting a person</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-slate-500">
                            Nodes with a <strong>DIRECTOR</strong> edge appear first (★ promoted). Selecting a node
                            calls <code className="bg-slate-100 px-1 rounded">updateStandingDataProperty</code> which
                            triggers <code className="bg-slate-100 px-1 rounded">FieldClaimService.assertClaim</code> →
                            write-back hook → <code className="bg-slate-100 px-1 rounded">ClientLEGraphEdge.upsert</code>.
                        </p>
                        <GraphNodePicker
                            clientLEId={selectedLeId}
                            graphNodeType={binding.graphNodeType}
                            filterEdgeType={binding.filterEdgeType}
                            filterActiveOnly={binding.filterActiveOnly}
                            allowCreate={binding.allowCreate}
                            pickerLabel={binding.pickerLabel}
                            isMultiValue={field?.isMultiValue ?? false}
                            selectedNodeIds={selectedNodeIds}
                            onSelect={handleAssertClaim}
                            onDeselect={handleDeselect}
                            disabled={isAssertingClaim}
                        />
                        {lastClaim && (
                            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                                <p className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1">
                                    <CheckCircle className="h-3.5 w-3.5" /> Last claim asserted
                                </p>
                                <p><span className="text-slate-500">Node:</span> <strong>{lastClaim.item.displayLabel}</strong></p>
                                <p><span className="text-slate-500">nodeId:</span> <code className="font-mono">{lastClaim.item.nodeId}</code></p>
                                <p className="mt-1 text-emerald-600">Refresh page to see the new edge in Step 4 below.</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Step 4: personIdsByEdgeType (what the Graph Explorer reads) */}
            {selectedLeId && (
                <section className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b px-6 py-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">4</span>
                        <h2 className="font-semibold text-slate-800">personIdsByEdgeType — what the Graph Explorer reads</h2>
                        <Button
                            size="sm" variant="ghost"
                            className="ml-auto text-xs h-6"
                            onClick={() => router.refresh()}
                        >
                            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                        </Button>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Edge table */}
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">All Graph Edges ({graphEdges.length})</p>
                            {graphEdges.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No edges yet — select a person above to create one.</p>
                            ) : (
                                <div className="rounded-lg border overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-slate-500">Edge Type</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-500">fromNodeId</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-500">Source</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-500">Active</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {graphEdges.map((e: any) => (
                                                <tr key={e.id} className="border-b last:border-0">
                                                    <td className="px-3 py-2 font-mono font-semibold text-slate-700">{e.edgeType}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-500 truncate max-w-[200px]">{e.fromNodeId}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant="outline" className={e.source === 'USER_INPUT' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'}>
                                                            {e.source}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {e.isActive
                                                            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                            : <span className="text-slate-300">—</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* personIdsByEdgeType */}
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">personIdsByEdgeType (Graph Explorer input)</p>
                            {Object.keys(personIdsByEdgeType).length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Empty — no active person edges yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {Object.entries(personIdsByEdgeType).map(([edgeType, ids]) => (
                                        <div key={edgeType} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                            <code className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                                                {edgeType}
                                            </code>
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-none" />
                                            <div className="flex flex-wrap gap-1">
                                                {(ids as string[]).map((personId: string) => {
                                                    const node = graphNodes.find(n => n.personId === personId);
                                                    const label = node?.person
                                                        ? [node.person.firstName, node.person.lastName].filter(Boolean).join(" ")
                                                        : personId.slice(0, 8) + "…";
                                                    return (
                                                        <Badge key={personId} variant="outline" className="text-xs bg-white">
                                                            {label}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {personIdsByEdgeType['DIRECTOR'] && (
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                                    <p className="text-amber-800 font-medium">
                                        ✓ DIRECTOR entries exist — the "Active Directors" filter on the Graph Explorer will show {personIdsByEdgeType['DIRECTOR'].length} person{personIdsByEdgeType['DIRECTOR'].length !== 1 ? 's' : ''}.
                                    </p>
                                    <p className="text-amber-600 mt-0.5">
                                        Navigate to <code className="bg-amber-100 px-1 rounded">/app/le/[id]/graph?filter=directors</code> to verify.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
