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
import { Loader2, History, Database, Edit, CheckCircle, AlertTriangle, Paperclip, FileText, Download, X, User as UserIcon } from "lucide-react";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { updateFieldManually, applyCandidate, updateCustomFieldManually, createRepeatingFieldRow, applyBulkOverride } from "@/actions/kyc-manual-update";
import { getMasterFieldDocuments, setMasterFieldAssignment } from "@/actions/standing-data";
import { getLETeamMembers } from "@/actions/kanban-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface FieldDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    legalEntityId: string;
    fieldNo: number;
    fieldName: string;
    customFieldId?: string;
    onUpdate?: (value: any, source: string, updatedAt: Date) => void;
}

export function FieldDetailPanel({ open, onOpenChange, legalEntityId, fieldNo, fieldName, customFieldId, onUpdate }: FieldDetailPanelProps) {
    const [data, setData] = useState<FieldDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Manual Edit State
    const [manualValue, setManualValue] = useState("");
    const [manualReason, setManualReason] = useState("");
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [relatedValues, setRelatedValues] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Evidence State
    const [evidenceDocs, setEvidenceDocs] = useState<any[]>([]);
    const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
    const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Team/Assignment State
    const [team, setTeam] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    const fieldKey = String(fieldNo || customFieldId || "");

    useEffect(() => {
        if (open && (fieldNo || customFieldId)) {
            loadData();
            loadEvidence();
            loadTeam();
        }
    }, [open, fieldNo, customFieldId, legalEntityId]);

    const loadTeam = async () => {
        const res = await getLETeamMembers(legalEntityId);
        if (res.success && res.team) {
            setTeam(res.team);
        }
    };

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

    // Pre-populate related values when a row is selected
    useEffect(() => {
        if (selectedRowId && data?.rows) {
            const row = data.rows.find(r => r.id === selectedRowId);
            if (row && row.data) {
                // Determine model and relevant fields
                const model = data?.fieldNo ? FIELD_DEFINITIONS[data.fieldNo]?.model : null;
                const related: Record<string, any> = {};

                if (model === 'Stakeholder') {
                    related.fullName = row.data.fullName || "";
                    related.legalName = row.data.legalName || "";
                } else if (model === 'Contact') {
                    related.email = row.data.email || "";
                    related.phone = row.data.phone || "";
                }

                setRelatedValues(related);
            }
        } else {
            setRelatedValues({});
        }
    }, [selectedRowId, data?.rows, data?.fieldNo]);

    const handleAddEntry = async () => {
        setIsSaving(true);
        try {
            const res = await createRepeatingFieldRow(legalEntityId, fieldNo);
            if (res.success && res.rowId) {
                toast.success("New entry created. You can now override it.");
                await loadData();
                setSelectedRowId(res.rowId);

                // Set default manual value based on model context
                const model = fieldNo ? FIELD_DEFINITIONS[fieldNo]?.model : null;
                if (model === 'Stakeholder') {
                    setManualValue("UBO");
                } else if (model === 'Contact') {
                    setManualValue("NOTICE");
                } else {
                    setManualValue("");
                }

                setIsEditing(true);
            } else {
                toast.error(res.message || "Failed to create entry");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualSave = async () => {
        if (!manualValue || !manualReason) {
            toast.error("Value and Reason are required");
            return;
        }

        // 1. Repeating Field Check
        if (data?.isRepeating && !selectedRowId) {
            toast.error("Please select a specific row to override.");
            return;
        }

        // 2. Document Field Check
        if (data?.dataType === 'document') {
            toast.error("Document fields cannot be updated with text. Use the Evidence tab.");
            return;
        }

        setIsSaving(true);
        try {
            let result;
            if (customFieldId) {
                result = await updateCustomFieldManually(legalEntityId, customFieldId, manualValue, manualReason, "CURRENT_USER_ID");
            } else {
                if (!data) {
                    toast.error("Data not loaded");
                    return;
                }
                // Determine if we need bulk update
                const row = data.rows?.find((r: any) => r.id === selectedRowId);
                const model = data.fieldNo ? FIELD_DEFINITIONS[data.fieldNo as keyof typeof FIELD_DEFINITIONS]?.model : null;

                if (row && model && Object.keys(relatedValues).length > 0) {
                    const fieldDef = FIELD_DEFINITIONS[data.fieldNo as keyof typeof FIELD_DEFINITIONS];
                    const fieldNameInModel = fieldDef.field!;
                    const updates = {
                        [fieldNameInModel]: manualValue,
                        ...relatedValues
                    };
                    result = await applyBulkOverride(legalEntityId, model, updates, manualReason, selectedRowId!, 'CLIENT_LE');
                } else {
                    result = await updateFieldManually(legalEntityId, fieldNo, manualValue, manualReason, "CURRENT_USER_ID", selectedRowId || undefined);
                }

            }

            if (result.success) {
                toast.success("Field updated successfully");
                setIsEditing(false);
                setManualReason("");
                setRelatedValues({});
                const refreshed = await getFieldDetail(legalEntityId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error(result.message || "Update failed");
            }
        } catch (error) {
            console.error("Save error:", error);
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
                    const refreshed = await getFieldDetail(legalEntityId, fieldNo, 'CLIENT_LE', customFieldId);
                    setData(refreshed);
                    if (onUpdate && refreshed.current) {
                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                    }
                } else {
                    toast.error(result.message || "Failed to apply candidate");
                }
            } catch (e) {
                toast.error("Error applying candidate");
            }
        }
    };

    const handleAssign = async (userId: string | null) => {
        if (customFieldId) {
            toast.error("Assignments on custom fields are not yet supported.");
            return;
        }

        setIsAssigning(true);
        try {
            const res = await setMasterFieldAssignment(legalEntityId, fieldNo, userId);
            if (res.success) {
                toast.success(userId ? "Field assigned successfully" : "Assignment removed");
                await loadData();
            } else {
                toast.error(res.error || "Failed to assign field");
            }
        } catch (e) {
            toast.error("An error occurred during assignment.");
        } finally {
            setIsAssigning(false);
        }
    };

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[900px] sm:max-w-[800px] flex flex-col h-full">
                <SheetHeader className="pb-4 border-b flex flex-row items-start justify-between">
                    <div>
                        <SheetTitle className="flex items-center gap-2">
                            {fieldName}
                            {fieldNo > 0 && <Badge variant="outline">Field {fieldNo}</Badge>}
                        </SheetTitle>
                        <SheetDescription>
                            Audit history, candidates, and evidence for {fieldName}.
                        </SheetDescription>
                    </div>

                    {/* Assignment UI */}
                    <div className="flex items-center mt-1 mr-8">
                        {isAssigning ? (
                            <div className="flex items-center px-3 py-1.5 text-xs text-slate-500 gap-2 border rounded-md">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Assigning...
                            </div>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 shadow-sm group">
                                        {data?.assignment?.assignedUser ? (
                                            <>
                                                <Avatar className="h-5 w-5 mr-1.5 border">
                                                    <AvatarFallback className="text-[9px] bg-indigo-50 text-indigo-700 font-semibold">
                                                        {(data.assignment.assignedUser.name || data.assignment.assignedUser.email || "U").substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs truncate max-w-[100px] font-medium text-slate-700">
                                                    {data.assignment.assignedUser.name || data.assignment.assignedUser.email}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <UserIcon className="h-3.5 w-3.5 mr-1.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                                                <span className="text-xs text-slate-500 group-hover:text-slate-800 transition-colors font-medium">Unassigned</span>
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px]">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border-b mb-1">Assign to Team Member</div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        <DropdownMenuItem
                                            className="text-xs py-2 cursor-pointer"
                                            onClick={() => handleAssign(null)}
                                        >
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <UserIcon className="h-4 w-4" />
                                                <span>Unassigned</span>
                                            </div>
                                        </DropdownMenuItem>
                                        {team.map((user) => (
                                            <DropdownMenuItem
                                                key={user.id}
                                                className="text-xs py-2 cursor-pointer focus:bg-indigo-50"
                                                onClick={() => handleAssign(user.id)}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <Avatar className="h-5 w-5 shrink-0">
                                                        <AvatarFallback className="text-[9px] bg-slate-100 text-slate-600">
                                                            {user.name?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-medium text-slate-900 truncate">{user.name}</span>
                                                        {(user.name && user.name !== user.email) && (
                                                            <span className="text-[10px] text-slate-500 truncate">{user.email}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
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
                                {data?.isRepeating && data.rows && data.rows.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.rows.map((row, i) => (
                                            <div
                                                key={row.id}
                                                className={cn(
                                                    "p-3 rounded-lg border bg-white transition-all",
                                                    selectedRowId === row.id ? "ring-2 ring-indigo-500 border-transparent shadow-sm" : "border-slate-200 hover:border-slate-300"
                                                )}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                                {row.label || `Entry #${i + 1}`}
                                                            </span>
                                                            <SourceBadge source={row.source as any} />
                                                        </div>
                                                        <div className="text-sm font-mono font-medium text-slate-900 break-all leading-relaxed">
                                                            {String(row.value) || <span className="text-slate-400 italic">Empty</span>}
                                                        </div>
                                                        <div className="mt-1.5 text-[10px] text-slate-400">
                                                            Last Sync: {row.timestamp ? new Date(row.timestamp).toLocaleString() : 'Never'}
                                                        </div>
                                                    </div>
                                                    {!isEditing && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                            onClick={() => {
                                                                setSelectedRowId(row.id);
                                                                setManualValue(String(row.value));
                                                                setIsEditing(true);
                                                            }}
                                                        >
                                                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                                                            Override
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex gap-2 pt-1">
                                            {!isEditing && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full border-dashed text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                    onClick={handleAddEntry}
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Edit className="h-3 w-3 mr-2" />}
                                                    Add New Entry
                                                </Button>
                                            )}
                                        </div>
                                        {!isEditing && (
                                            <div className="text-[10px] text-slate-400 italic px-1 pt-1">
                                                * This is a repeating field. Each entry above manages a different aspect of the Master Data (e.g. a different Stakeholder).
                                            </div>
                                        )}
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
                                        {data?.isRepeating && !isEditing && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-4 w-full border-dashed text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                onClick={handleAddEntry}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Edit className="h-3 w-3 mr-2" />}
                                                Add First Entry
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isEditing && !data?.isRepeating && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 w-full border-dashed text-slate-500 hover:text-slate-800"
                                disabled={data?.dataType === 'document'}
                                title={data?.dataType === 'document' ? "Document fields must be updated via Evidence tab" : ""}
                                onClick={() => {
                                    setManualValue(String(data?.current?.value || ""));
                                    setIsEditing(true);
                                    // No related values for single field 1:1 usually, or handle here if needed
                                    setRelatedValues({});
                                }}
                            >
                                <Edit className="h-3 w-3 mr-2" />
                                {data?.dataType === 'document' ? 'Use Evidence Tab for Documents' : 'Manually Edit / Override'}
                            </Button>
                        )}

                        {isEditing && (
                            <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-4">
                                    {selectedRowId && (
                                        <div className="bg-indigo-50 p-2 rounded text-[10px] font-medium text-indigo-700 flex items-center justify-between">
                                            <span>
                                                EDITING ENTRY: {data?.rows?.find(r => r.id === selectedRowId)?.label || "Specific Row"}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-0 text-[10px] hover:bg-transparent hover:underline"
                                                onClick={() => {
                                                    setSelectedRowId(null);
                                                    setIsEditing(false);
                                                }}
                                            >
                                                Cancel Edit
                                            </Button>
                                        </div>
                                    )}

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-tight">
                                                {fieldName} (Primary Value)
                                            </label>
                                            {fieldNo && FIELD_DEFINITIONS[fieldNo]?.options ? (
                                                <Select value={manualValue} onValueChange={setManualValue}>
                                                    <SelectTrigger className="w-full bg-white border-slate-300">
                                                        <SelectValue placeholder={`Select ${fieldName}...`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {FIELD_DEFINITIONS[fieldNo].options!.map((opt: string) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    value={manualValue}
                                                    onChange={(e) => setManualValue(e.target.value)}
                                                    placeholder={`Enter ${fieldName}...`}
                                                    className="bg-white border-slate-300"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ─── Related Fields (UX Enhancement) ─── */}
                                {selectedRowId && (data?.fieldNo === 62 || data?.fieldNo === 63 || data?.fieldNo === 64) && (
                                    <div className="space-y-3 bg-slate-50 p-3 rounded-md border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Related Information</p>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Stakeholder Full Name</label>
                                            <Input
                                                value={relatedValues.fullName || ""}
                                                onChange={(e) => setRelatedValues(prev => ({ ...prev, fullName: e.target.value }))}
                                                placeholder="Enter full name..."
                                                className="h-8 text-xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Legal Name (Corporate)</label>
                                            <Input
                                                value={relatedValues.legalName || ""}
                                                onChange={(e) => setRelatedValues(prev => ({ ...prev, legalName: e.target.value }))}
                                                placeholder="Enter legal name..."
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Contact Model Related Fields */}
                                {selectedRowId && (fieldName.toLowerCase().includes('contact')) && (
                                    <div className="space-y-3 bg-slate-50 p-3 rounded-md border border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Related Information</p>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Email Address</label>
                                            <Input
                                                value={relatedValues.email || ""}
                                                onChange={(e) => setRelatedValues(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder="Enter email..."
                                                className="h-8 text-xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-slate-500">Phone Number</label>
                                            <Input
                                                value={relatedValues.phone || ""}
                                                onChange={(e) => setRelatedValues(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="Enter phone..."
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-tight">Audit Reason (Required)</label>
                                    <Textarea
                                        value={manualReason}
                                        onChange={(e) => setManualReason(e.target.value)}
                                        placeholder="Explain why this override is necessary for compliance/audit purposes..."
                                        className="h-24 bg-white border-slate-300 focus:ring-indigo-500 shadow-sm"
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
                        )}
                    </div> {/* Closes the "Current Value Card" div */}

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
                            <ScrollArea className="h-full w-full rounded-md border p-4">
                                <div className="relative border-l border-slate-200 ml-3 space-y-6">
                                    {data?.history && data.history.length > 0 ? (
                                        data.history.map((item) => (
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
                            <ScrollArea className="h-full w-full rounded-md border p-4">
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
        </Sheet >
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
        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", classes)}>
            {source}
        </span>
    );
}
