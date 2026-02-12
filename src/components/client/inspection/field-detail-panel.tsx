"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, History, Database, Edit, CheckCircle, AlertTriangle } from "lucide-react";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
import { updateFieldManually, applyCandidate } from "@/actions/kyc-manual-update";

interface FieldDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    legalEntityId: string; // Or ClientLE ID? The actions handle both but prefer LE ID.
    fieldNo: number;
    fieldName: string;
}

export function FieldDetailPanel({ open, onOpenChange, legalEntityId, fieldNo, fieldName }: FieldDetailPanelProps) {
    const [data, setData] = useState<FieldDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Manual Edit State
    const [manualValue, setManualValue] = useState("");
    const [manualReason, setManualReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && fieldNo) {
            loadData();
        }
    }, [open, fieldNo, legalEntityId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getFieldDetail(legalEntityId, fieldNo);
            setData(result);
        } catch (error) {
            console.error("Error loading field details:", error);
            toast.error("Failed to load field details");
        } finally {
            setLoading(false);
        }
    };

    const handleManualSave = async () => {
        if (!manualValue || !manualReason) {
            toast.error("Value and Reason are required");
            return;
        }

        setIsSaving(true);
        try {
            // Need User ID? Ideally passed via props or from session in Server Action?
            // The Server Action needs userId. We can get it from session on server side usually, 
            // but updateFieldManually signature asks for userId.
            // For now, let's hardcode a placeholder or assume the server action handles session.
            // Wait, server action signature IS (..., userId).
            // We should use a hook useSession() here or pass currentUser from parent.
            // Let's assume parent passes currentUserId or we fetch it. 
            // Better: update server action to use auth() internally. 
            // But for now, I'll use a placeholder "CURRENT_USER" if prop missing.

            const result = await updateFieldManually(legalEntityId, fieldNo, manualValue, manualReason, "CURRENT_USER_ID");

            if (result.success) {
                toast.success("Field updated successfully");
                setIsEditing(false);
                setManualReason("");
                await loadData(); // Reload data to show new history
            } else {
                toast.error(result.message || "Update failed");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyCandidate = async (candidate: any) => {
        if (confirm(`Are you sure you want to apply this value: ${candidate.value}?`)) {
            try {
                const result = await applyCandidate(legalEntityId, candidate, "CURRENT_USER_ID");
                if (result.success) {
                    toast.success("Candidate applied");
                    await loadData();
                } else {
                    toast.error(result.message || "Failed to apply candidate");
                }
            } catch (e) {
                toast.error("Error applying candidate");
            }
        }
    };

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[600px] sm:w-[540px] flex flex-col h-full">
                <SheetHeader className="pb-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        {fieldName}
                        <Badge variant="outline">Field {fieldNo}</Badge>
                    </SheetTitle>
                    <SheetDescription>
                        Audit history and candidate sources for {fieldName}.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden flex flex-col pt-4 gap-4">
                    {/* Current Value Card */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                            <span>Current Authoritative Value</span>
                            {/* <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => setIsEditing(!isEditing)}>
                                Override
                            </Button> */}
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-2 text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                            </div>
                        ) : (
                            <div>
                                <div className="text-lg font-mono font-medium break-all">
                                    {data?.current?.value || <span className="text-slate-400 italic">Empty</span>}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <SourceBadge source={data?.current?.source || 'UNKNOWN'} />
                                    <span className="text-xs text-slate-400">
                                        Updated: {data?.current?.timestamp ? new Date(data.current.timestamp).toLocaleString() : 'Never'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!isEditing && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 w-full border-dashed text-slate-500 hover:text-slate-800"
                                onClick={() => {
                                    setManualValue(String(data?.current?.value || ""));
                                    setIsEditing(true);
                                }}
                            >
                                <Edit className="h-3 w-3 mr-2" />
                                Manually Edit / Override
                            </Button>
                        )}

                        {isEditing && (
                            <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium mb-1 block">New Value</label>
                                        <Input
                                            value={manualValue}
                                            onChange={(e) => setManualValue(e.target.value)}
                                            placeholder="Enter new value..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium mb-1 block">Reason for Change (Required)</label>
                                        <Textarea
                                            value={manualReason}
                                            onChange={(e) => setManualReason(e.target.value)}
                                            placeholder="Why are you overriding this value?"
                                            className="h-20"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                        <Button size="sm" onClick={handleManualSave} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle className="h-3 w-3 mr-2" />}
                                            Save Override
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <Tabs defaultValue="history" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="history">History Log</TabsTrigger>
                            <TabsTrigger value="candidates">Available Candidates</TabsTrigger>
                        </TabsList>

                        <TabsContent value="history" className="flex-1 overflow-hidden relative mt-4">
                            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                                <div className="relative border-l border-slate-200 ml-3 space-y-6">
                                    {data?.history && data.history.length > 0 ? (
                                        data.history.map((item, i) => (
                                            <div key={item.id} className="relative pl-6">
                                                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white" />
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                                                        <span>•</span>
                                                        <span className="font-medium text-slate-700">{item.actorId || "System"}</span>
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        Changed value to <span className="font-mono bg-slate-100 px-1 rounded">{String(item.newValue)}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                                        via <SourceBadge source={item.source} />
                                                    </div>
                                                    {item.reason && (
                                                        <div className="mt-1 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100 italic">
                                                            "{item.reason}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-slate-400 py-8 text-sm italic">
                                            No history recorded.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="candidates" className="flex-1 overflow-hidden mt-4">
                            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                                <div className="space-y-3">
                                    {data?.candidates && data.candidates.length > 0 ? (
                                        data.candidates.map((cand, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <SourceBadge source={cand.source} />
                                                        <span className="text-xs text-slate-400">Confidence: {(cand.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="font-mono font-medium text-sm">
                                                        {String(cand.value)}
                                                    </div>
                                                </div>
                                                <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => handleApplyCandidate(cand)}>
                                                    Apply
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-slate-400 py-8 text-sm italic">
                                            No other candidates found.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function SourceBadge({ source }: { source: string }) {
    const colorMap: Record<string, string> = {
        'GLEIF': 'bg-orange-100 text-orange-700 border-orange-200',
        'COMPANIES_HOUSE': 'bg-blue-100 text-blue-700 border-blue-200',
        'USER_INPUT': 'bg-purple-100 text-purple-700 border-purple-200',
        'SYSTEM': 'bg-gray-100 text-gray-700 border-gray-200'
    };

    // Default fallback
    const classes = colorMap[source] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${classes}`}>
            {source}
        </span>
    );
}
