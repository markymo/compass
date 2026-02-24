"use client";

import { useEffect, useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, History, Database, Edit, CheckCircle, AlertTriangle, Paperclip, FileText, Download, X } from "lucide-react";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
import { updateFieldManually, applyCandidate, updateCustomFieldManually } from "@/actions/kyc-manual-update";
import { getMasterFieldDocuments } from "@/actions/standing-data";

interface FieldDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    legalEntityId: string;
    fieldNo: number;
    fieldName: string;
    customFieldId?: string;
}

export function FieldDetailPanel({ open, onOpenChange, legalEntityId, fieldNo, fieldName, customFieldId }: FieldDetailPanelProps) {
    const [data, setData] = useState<FieldDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Manual Edit State
    const [manualValue, setManualValue] = useState("");
    const [manualReason, setManualReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Evidence State
    const [evidenceDocs, setEvidenceDocs] = useState<any[]>([]);
    const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
    const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fieldKey = String(fieldNo || customFieldId || "");

    useEffect(() => {
        if (open && (fieldNo || customFieldId)) {
            loadData();
            loadEvidence();
        }
    }, [open, fieldNo, customFieldId, legalEntityId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getFieldDetail(legalEntityId, fieldNo, 'CLIENT_LE', customFieldId);
            setData(result);
        } catch (error) {
            console.error("Error loading field details:", error);
            toast.error("Failed to load field details");
        } finally {
            setLoading(false);
        }
    };

    const loadEvidence = async () => {
        if (!fieldKey) return;
        setIsLoadingEvidence(true);
        try {
            const res = await getMasterFieldDocuments(legalEntityId, fieldKey);
            setEvidenceDocs(res.documents || []);
        } catch (e) {
            console.error("Evidence load failed:", e);
        } finally {
            setIsLoadingEvidence(false);
        }
    };

    const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingEvidence(true);
        try {
            // Use a simple FormData POST to the server-side upload route.
            // This avoids the @vercel/blob/client two-step handshake which
            // has Turbopack dev compatibility issues.
            const form = new FormData();
            form.append('file', file);
            form.append('leId', legalEntityId);
            form.append('fieldKey', fieldKey);

            const res = await fetch('/api/upload-evidence', {
                method: 'POST',
                body: form,
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(`Upload failed: ${data.error || 'Unknown error'}`);
                return;
            }

            // Optimistic update
            setEvidenceDocs(prev => [{
                id: data.document?.id || data.url,
                name: file.name,
                fileUrl: data.url,
                fileType: file.name.split('.').pop() || 'file',
                kbSize: Math.round(file.size / 1024),
                createdAt: new Date(),
            }, ...prev]);

            toast.success("Evidence attached");
        } catch (error) {
            console.error("Upload error", error);
            toast.error("Failed to upload evidence");
        } finally {
            setIsUploadingEvidence(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleManualSave = async () => {
        if (!manualValue || !manualReason) {
            toast.error("Value and Reason are required");
            return;
        }

        setIsSaving(true);
        try {
            let result;
            if (customFieldId) {
                result = await updateCustomFieldManually(legalEntityId, customFieldId, manualValue, manualReason, "CURRENT_USER_ID");
            } else {
                result = await updateFieldManually(legalEntityId, fieldNo, manualValue, manualReason, "CURRENT_USER_ID");
            }

            if (result.success) {
                toast.success("Field updated successfully");
                setIsEditing(false);
                setManualReason("");
                await loadData();
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
                        {fieldNo > 0 && <Badge variant="outline">Field {fieldNo}</Badge>}
                    </SheetTitle>
                    <SheetDescription>
                        Audit history, candidates, and evidence for {fieldName}.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden flex flex-col pt-4 gap-4">
                    {/* Current Value Card */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Current Authoritative Value
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

                    <Tabs defaultValue="evidence" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="evidence" className="gap-1.5">
                                <Paperclip className="h-3.5 w-3.5" />
                                Evidence
                                {evidenceDocs.length > 0 && (
                                    <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 rounded-full font-medium">
                                        {evidenceDocs.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="history">History Log</TabsTrigger>
                            <TabsTrigger value="candidates">Candidates</TabsTrigger>
                        </TabsList>

                        {/* ─── Evidence Tab ─── */}
                        <TabsContent value="evidence" className="flex-1 overflow-hidden mt-4 flex flex-col gap-3">
                            {/* Upload button */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                disabled={isUploadingEvidence}
                                onChange={handleEvidenceUpload}
                            />
                            <Button
                                variant="outline"
                                className="w-full border-dashed gap-2 h-9"
                                disabled={isUploadingEvidence}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {isUploadingEvidence
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                                    : <><Paperclip className="h-4 w-4" /> Attach Evidence File</>
                                }
                            </Button>

                            <ScrollArea className="flex-1 rounded-md border">
                                {isLoadingEvidence ? (
                                    <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading evidence...
                                    </div>
                                ) : evidenceDocs.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm italic">No evidence attached yet.</p>
                                        <p className="text-xs mt-1">Upload supporting documents above.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {evidenceDocs.map((doc) => (
                                            <div key={doc.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 group">
                                                <div className="h-8 w-8 rounded bg-indigo-50 flex items-center justify-center shrink-0">
                                                    <FileText className="h-4 w-4 text-indigo-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {doc.fileType?.toUpperCase()}
                                                        {doc.kbSize ? ` · ${doc.kbSize} KB` : ''}
                                                        {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    asChild
                                                >
                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Download className="h-3.5 w-3.5" />
                                                    </a>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>

                        {/* ─── History Tab ─── */}
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

                        {/* ─── Candidates Tab ─── */}
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

    const classes = colorMap[source] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${classes}`}>
            {source}
        </span>
    );
}
