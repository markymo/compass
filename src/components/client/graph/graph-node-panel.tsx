"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Pencil, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { getAuditHistory } from "@/actions/audit-actions";
import { NodeCreateDialog } from "./node-create-dialog";

interface GraphNodePanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: any; // The selected ClientLEGraphNode with populated person/legalEntity/address
    clientLEId: string;
    onNodeUpdated: () => void;
}

export function GraphNodePanel({ open, onOpenChange, node, clientLEId, onNodeUpdated }: GraphNodePanelProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (open && node) {
            loadHistory();
        }
    }, [open, node]);

    const loadHistory = async () => {
        if (!node) return;
        setIsLoadingHistory(true);
        const entityId = node.personId || node.legalEntityId || node.addressId;
        const entityType = node.nodeType; // "PERSON", "LEGAL_ENTITY", "ADDRESS"
        
        if (entityId && entityType) {
            const res = await getAuditHistory(entityType, entityId);
            if (res.success) {
                setHistory(res.logs || []);
            }
        }
        setIsLoadingHistory(false);
    };

    if (!node) return null;

    let displayLabel = "Unknown";
    if (node.nodeType === "PERSON") displayLabel = [node.person?.firstName, node.person?.lastName].filter(Boolean).join(" ") || "Unknown Person";
    else if (node.nodeType === "LEGAL_ENTITY") displayLabel = node.legalEntity?.name || "Unknown Entity";
    else if (node.nodeType === "ADDRESS") displayLabel = node.address?.line1 || "Unknown Address";

    const entityId = node.personId || node.legalEntityId || node.addressId;

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
                    <SheetHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-start justify-between">
                            <div>
                                <SheetTitle className="text-lg font-bold">{displayLabel}</SheetTitle>
                                <SheetDescription className="text-xs uppercase tracking-wider font-semibold mt-1">
                                    {node.nodeType.replace("_", " ")}
                                </SheetDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Edit Node
                            </Button>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6">
                        <Tabs defaultValue="history" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="details">Details</TabsTrigger>
                                <TabsTrigger value="history" className="gap-2">
                                    <Clock className="w-3.5 h-3.5" />
                                    Audit History
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="details" className="mt-4 space-y-4">
                                <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <p className="mb-2 text-xs font-semibold text-slate-400 uppercase">Current Data</p>
                                    <pre className="text-[10px] whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(node.person || node.legalEntity || node.address, null, 2)}
                                    </pre>
                                </div>
                            </TabsContent>

                            <TabsContent value="history" className="mt-4">
                                {isLoadingHistory ? (
                                    <div className="text-center text-sm text-slate-400 py-8">Loading history...</div>
                                ) : history.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 italic py-8 border border-dashed rounded-lg bg-slate-50">
                                        No audit logs found for this entity.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {history.map((log) => (
                                            <div key={log.id} className="relative pl-6 border-l-2 border-slate-200 ml-2 pb-4">
                                                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-slate-300" />
                                                <div className="text-xs text-slate-500 mb-1">
                                                    {new Date(log.createdAt).toLocaleString()} • {log.actorUserId ? 'User' : 'System'}
                                                </div>
                                                <div className="text-sm font-medium text-slate-800">
                                                    {log.action} {log.entityType}
                                                </div>
                                                {log.changedFields && log.changedFields.length > 0 && (
                                                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                                        <span className="font-semibold block mb-1">Changed fields:</span>
                                                        <div className="space-y-1">
                                                            {log.changedFields.map((f: string) => (
                                                                <div key={f} className="flex gap-2">
                                                                    <span className="text-slate-400 w-20 truncate">{f}:</span>
                                                                    <span className="text-red-500 line-through mr-1">
                                                                        {JSON.stringify((log.oldData as any)?.[f]) || 'null'}
                                                                    </span>
                                                                    <span className="text-green-600">
                                                                        {JSON.stringify((log.newData as any)?.[f]) || 'null'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </SheetContent>
            </Sheet>

            {isEditing && entityId && (
                <NodeCreateDialog
                    open={isEditing}
                    onOpenChange={setIsEditing}
                    clientLEId={clientLEId}
                    nodeType={node.nodeType as any}
                    entityId={entityId}
                    initialData={node.person || node.legalEntity || node.address}
                    onSuccess={() => {
                        setIsEditing(false);
                        loadHistory();
                        onNodeUpdated(); // Trigger refresh in parent
                    }}
                />
            )}
        </>
    );
}
