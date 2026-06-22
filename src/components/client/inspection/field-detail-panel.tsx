"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, History, Database, Edit, CheckCircle, CheckCircle2, AlertTriangle, Paperclip, FileText, Download, X, User as UserIcon, Pencil, Check, Trash2, Plus, Lock, Save, Link2Off, ArrowRightLeft } from "lucide-react";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
// FIELD_DEFINITIONS removed
import { updateFieldManually, applyCandidate, updateCustomFieldManually, addMultiValueEntry, removeMultiValueEntry, applyBulkOverride, promoteClaim } from "@/actions/kyc-manual-update";
import { promoteClaimToCCParty } from "@/actions/cc-party-actions";
import { saveAddressForReuse } from "@/actions/cc-address-actions";
import { getMasterFieldDocuments, setMasterFieldAssignment } from "@/actions/standing-data";
import { renameCustomField } from "@/actions/master-data-governance";
import { saveMasterFieldNote } from "@/actions/master-data-notes";
import { getLETeamMembers } from "@/actions/kanban-actions";
import { getGraphBindingsForField } from "@/actions/graph-bindings";
import { getSourceDisplayName } from "@/lib/source-display";
import { GraphNodePicker, GraphNodePickerSelection } from "@/components/client/graph/graph-node-picker";
import { GraphNodePickerDialog } from "@/components/client/graph/graph-node-picker-dialog";
import { NodeCreateDialog } from "@/components/client/graph/node-create-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CollectionRowDisplay } from "@/lib/master-data/structured-collection-renderers";
import { CodeListField } from "@/components/client/fields/CodeListField";
import { AddressValueViewer } from "../fields/AddressValueViewer";
import { isAddressValue } from "@/lib/master-data/address-value";
import { AddressValueEditor } from "../fields/AddressValueEditor";
import { UnifiedAddressPicker } from "../fields/UnifiedAddressPicker";
import { isPersonOrContactValue, getPersonOrContactSummary, isValidPartyValue } from "@/lib/master-data/person-or-contact-value";
import { PersonOrContactValueViewer } from "../fields/PersonOrContactValueViewer";
import { PersonOrContactValueEditor } from "../fields/PersonOrContactValueEditor";
import { PartyRefValueEditor } from "../fields/PartyRefValueEditor";
import { UnifiedPartyPicker } from "../fields/UnifiedPartyPicker";
import { inferClaimValueKind, ClaimValueKind } from "@/lib/master-data/claim-value-resolver";

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
    clientLEId: string;
    fieldNo: number;
    fieldName: string;
    customFieldId?: string;
    isLocked?: boolean;
    onUpdate?: (value: any, source: string, updatedAt: Date) => void;
    /** Entity-specific GLEIF RA code, e.g. RA000585. Shown in SourceBadge for RA sources only. */
    registrationAuthorityId?: string;
}

export function FieldDetailPanel({ open, onOpenChange, clientLEId, fieldNo, fieldName, customFieldId, isLocked, onUpdate, registrationAuthorityId }: FieldDetailPanelProps) {
    const [data, setData] = useState<FieldDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Manual Edit State
    const [manualValue, setManualValue] = useState<any>("");
    const [manualReason, setManualReason] = useState("");
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [relatedValues, setRelatedValues] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isClearingSingleValue, setIsClearingSingleValue] = useState(false);

    // Multi-value inline management state
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingRowValue, setEditingRowValue] = useState<any>("");
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    const [newEntryValue, setNewEntryValue] = useState("");
    const [isAddingSaving, setIsAddingSaving] = useState(false);
    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [newPersonData, setNewPersonData] = useState<any>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const newEntryInputRef = useRef<HTMLInputElement>(null);

    // Date & value formatting helpers
    const isDateType = data?.dataType === 'DATE' || data?.dataType === 'DATETIME';
    const isCuratedPartyRef = data?.dataType === 'PARTY_REF';
    const isCuratedAddressRef = data?.dataType === 'ADDRESS_REF';
    const isGraphRef = data?.dataType === 'PERSON_REF' || data?.dataType === 'ORG_REF' || data?.dataType === 'ADDRESS_REF';
    const isPartyRef = data?.dataType === 'PERSON_REF' || data?.dataType === 'ORG_REF';
    const isAddressRef = data?.dataType === 'ADDRESS_REF';
    const isPartyField = data?.dataType === 'PARTY' || data?.dataType === 'PERSON_OR_CONTACT';
    const isPersonOrContactField = isPartyField;
    const isAddressField = data?.dataType === 'ADDRESS';

    let isObjectRef = isGraphRef;
    if (isPartyField || isAddressField) {
        isObjectRef = false;
    }
    // Controlled-vocabulary collection: uses CodeListField UX instead of free-text
    const isCodeList = !!data?.codeSystem;
    
    const renderRowValue = (val: any, rowData?: any) => {
        if (!val) return <span className="text-slate-400 italic">No value provided</span>;
        
        let parsedVal = val;
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
                parsedVal = JSON.parse(val);
            } catch (e) {}
        }

        if (rowData?.data?.resolvedSummary || val?._resolvedData?.resolvedSummary) {
            const resolvedSummary = rowData?.data?.resolvedSummary || val?._resolvedData?.resolvedSummary;
            const resolvedType = rowData?.data?.resolvedType || val?._resolvedData?.resolvedType;
            return (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{resolvedSummary}</span>
                    {resolvedType && (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 py-0 h-4 leading-none tracking-wider text-slate-500">
                            {resolvedType}
                        </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">Ref</Badge>
                </div>
            );
        }

        if (rowData?.data?.isDeleted || val?._resolvedData?.isDeleted) {
            return <span className="text-red-400 italic">Deleted saved party</span>;
        }

        if (typeof parsedVal === 'object') {
            if (isAddressValue(parsedVal)) {
                return <AddressValueViewer value={parsedVal} layout="compact" />;
            }
            if (isPersonOrContactValue(parsedVal)) {
                return <PersonOrContactValueViewer value={parsedVal} layout="compact" />;
            }
            if (parsedVal.firstName || parsedVal.lastName) return `${parsedVal.firstName || ''} ${parsedVal.lastName || ''}`.trim() + (parsedVal.metadata_type === 'LEGAL_ENTITY' ? ' (Company)' : '');
            if (parsedVal.name) return parsedVal.name;
            if (parsedVal.line1) return `${parsedVal.line1}${parsedVal.city ? ', ' + parsedVal.city : ''}`;
            // Code-list items: { code, label } — e.g. SIC codes
            if (parsedVal.code !== undefined) return parsedVal.label ? `${parsedVal.code} — ${parsedVal.label}` : String(parsedVal.code);
            
            // If it is an unresolved reference
            if (parsedVal.ccPartyId) return <span className="text-slate-400 font-mono text-xs">{parsedVal.ccPartyId}</span>;

            return JSON.stringify(parsedVal);
        }
        return String(val);
    };


    const formatDateForInput = (val: string) => {
        if (!val) return '';
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return val;
            return d.toISOString().split('T')[0];
        } catch { return val; }
    };
    const parseDateFromInput = (val: string) => {
        if (!val) return '';
        return new Date(val + 'T00:00:00.000Z').toISOString();
    };

    // Evidence State
    const [evidenceDocs, setEvidenceDocs] = useState<any[]>([]);
    const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
    const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Team/Assignment State
    const [team, setTeam] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    // Custom Field Rename State
    const [isRenamingField, setIsRenamingField] = useState(false);
    const [renameFieldValue, setRenameFieldValue] = useState("");
    const [isRenamingSaving, setIsRenamingSaving] = useState(false);

    // Note State
    const [noteText, setNoteText] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Promote State
    const [isPromoting, setIsPromoting] = useState<string | null>(null);

    // Graph Binding State
    const [graphBindings, setGraphBindings] = useState<any[]>([]);
    const [isLoadingBindings, setIsLoadingBindings] = useState(false);
    
    // Node Creation/Editing State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createDialogType, setCreateDialogType] = useState<"PERSON" | "LEGAL_ENTITY" | "ADDRESS">("PERSON");
    const [initialNodeData, setInitialNodeData] = useState<any>(null);
    const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

    const fieldKey = String(fieldNo || customFieldId || "");

    const currentSelectionIds = useMemo(() => {
        if (!data) return [];
        if (data.isRepeating) {
            return (data.rows || []).map((r: any) => {
                const val = r.value;
                if (typeof val === 'object' && val) return val.id || val.nodeId || val.personId || val.addressId || val.legalEntityId;
                return val;
            }).filter(Boolean);
        } else {
            const val = data.current?.value;
            if (typeof val === 'object' && val) {
                const id = val.id || val.nodeId || val.personId || val.addressId || val.legalEntityId;
                return id ? [id] : [];
            }
            return val ? [val] : [];
        }
    }, [data]);

    useEffect(() => {
        if (open && (fieldNo || customFieldId)) {
            loadData();
            loadEvidence();
            loadTeam();
            if (fieldNo) loadGraphBindings();
        }
    }, [open, fieldNo, customFieldId, clientLEId]);

    // Reset edit state when switching to a different field
    useEffect(() => {
        setIsEditing(false);
        setManualValue("");
        setManualReason("");
        setSelectedRowId(null);
        setRelatedValues({});
        setIsSaving(false);
        setIsClearingSingleValue(false);
        setNoteText("");
        setInitialNodeData(null);
        setEditingEntityId(null);
    }, [fieldNo, customFieldId]);

    const loadTeam = async () => {
        const res = await getLETeamMembers(clientLEId);
        if (res.success && res.team) {
            setTeam(res.team);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
            setData(result);
            setNoteText(result?.userNote || "");
        } catch (error) {
            console.error("Error loading field details:", error);
            toast.error("Failed to load field details");
        } finally {
            setLoading(false);
        }
    };

    const loadGraphBindings = async () => {
        if (!fieldNo) return;
        setIsLoadingBindings(true);
        try {
            const res = await getGraphBindingsForField(fieldNo);
            if (res.success) {
                setGraphBindings(res.bindings || []);
            }
        } catch (e) {
            console.error("Failed to load graph bindings:", e);
        } finally {
            setIsLoadingBindings(false);
        }
    };

    const loadEvidence = async () => {
        if (!fieldKey) return;
        setIsLoadingEvidence(true);
        try {
            const res = await getMasterFieldDocuments(clientLEId, fieldKey);
            setEvidenceDocs(res.documents || []);
        } catch (e) {
            console.error("Evidence load failed:", e);
        } finally {
            setIsLoadingEvidence(false);
        }
    };

    const handleSaveNote = async () => {
        if (!fieldNo) return;
        setIsSavingNote(true);
        try {
            const res = await saveMasterFieldNote(clientLEId, fieldNo, noteText);
            if (res.success) {
                toast.success("Note saved successfully");
                if (data) {
                    setData({ ...data, userNote: noteText });
                }
            }
        } catch (e) {
            console.error("Failed to save note:", e);
            toast.error("Failed to save note");
        } finally {
            setIsSavingNote(false);
        }
    };

    const handlePromote = async (claimId: string) => {
        setIsPromoting(claimId);
        try {
            const res = await promoteClaim(clientLEId, claimId);
            if (res.success) {
                toast.success("Suggestion saved for reuse successfully");
                loadData(); // Reload stats and suggestions
                if (onUpdate) {
                    // Update parent UI with new authoritative value
                    onUpdate(data?.candidates.find(c => c.id === claimId)?.value, "USER_INPUT", new Date());
                }
            } else {
                toast.error(res.message || "Failed to save claim for reuse");
            }
        } catch (e) {
            console.error("Promote error:", e);
            toast.error("Save for reuse failed");
        } finally {
            setIsPromoting(null);
        }
    };

    const handleSaveForReuse = async (claimId: string, kind: string) => {
        setIsPromoting(claimId);
        try {
            if (kind === 'EMBEDDED_PARTY') {
                const res = await promoteClaimToCCParty(claimId, clientLEId);
                if (res.success) {
                    toast.success("Saved for reuse");
                    loadData(); // Reload rows to update isPromotedToCCC flag
                } else {
                    toast.error((res as any).message || "Failed to save for reuse");
                }
            } else if (kind === 'ADDRESS') {
                const res = await saveAddressForReuse(claimId, clientLEId);
                if (res.success) {
                    toast.success("Saved for reuse");
                    loadData(); // Reload rows to update isPromotedToCCC flag
                } else {
                    toast.error((res as any).message || "Failed to save for reuse");
                }
            }
        } catch (e: any) {
            console.error("Save for reuse error:", e);
            toast.error(e.message || "Failed to save for reuse");
        } finally {
            setIsPromoting(null);
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
            form.append('leId', clientLEId);
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
            const row = data.rows.find((r: any) => r.id === selectedRowId);
            if (row && row.data) {
                // Determine model and relevant fields
                const model = data?.category;
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
    }, [selectedRowId, data?.rows, data?.category]);

    const handleAddNewEntry = async (valToUse?: any) => {
        const val = valToUse !== undefined ? valToUse : newEntryValue;
        if (val == null) return;
        if (typeof val === 'string' && !val.trim()) return;
        setIsAddingSaving(true);
        try {
            const res = await addMultiValueEntry(clientLEId, fieldNo, typeof val === 'string' ? val.trim() : val);
            if (res.success) {
                toast.success("Value added");
                setNewEntryValue("");
                setIsAddingPerson(false);
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
                // Re-focus the add input
                setTimeout(() => newEntryInputRef.current?.focus(), 100);
            } else {
                toast.error(res.message || "Failed to add entry");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsAddingSaving(false);
        }
    };

    const handleGraphNodeSelect = async (item: GraphNodePickerSelection, overrideInstanceId?: string) => {
        const payloadValue =
            item.nodeType === "PERSON"
                ? item.personId
                : item.nodeType === "LEGAL_ENTITY"
                    ? item.legalEntityId
                    : item.addressId;

        if (!payloadValue) return;

        setIsAddingSaving(true);
        try {
            let res;
            if (overrideInstanceId) {
                // Updating a specific row in a multi-value field
                res = await updateFieldManually(clientLEId, fieldNo, payloadValue, `Updated graph linkage: ${item.displayLabel}`, overrideInstanceId, 'CLIENT_LE');
            } else if (data?.isRepeating) {
                // Adding a new row
                res = await addMultiValueEntry(clientLEId, fieldNo, payloadValue, `Linked to graph node: ${item.displayLabel}`);
            } else {
                // Updating a single-value field
                res = await updateFieldManually(clientLEId, fieldNo, payloadValue, `Linked to graph node: ${item.displayLabel}`, undefined, 'CLIENT_LE');
            }

            if (res.success) {
                toast.success(overrideInstanceId ? "Row updated" : (data?.isRepeating ? "Value added" : "Value updated"));
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                setEditingRowId(null);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error((res as any).message || (res as any).error || "Failed to update field");
            }
        } catch (e) {
            console.error("Graph node selection error:", e);
            toast.error("An error occurred");
        } finally {
            setIsAddingSaving(false);
        }
    };

    const handleCreateNewNode = (type: "PERSON" | "LEGAL_ENTITY" | "ADDRESS") => {
        setInitialNodeData(null);
        setEditingEntityId(null);
        setCreateDialogType(type);
        setCreateDialogOpen(true);
    };

    const handleEditNode = (row: any) => {
        const type = graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS");
        setCreateDialogType(type);
        setInitialNodeData(row.value);
        setEditingEntityId(row.value.id);
        setCreateDialogOpen(true);
    };

    const handleCreateSuccess = async (nodeId: string, entityId: string, displayLabel: string) => {
        if (editingEntityId) {
            // This was an update to an existing entity's data
            loadData();
            setEditingEntityId(null);
            setInitialNodeData(null);
            return;
        }

        // Automatically select the newly created node
        await handleGraphNodeSelect({
            nodeId,
            nodeType: createDialogType,
            personId: createDialogType === "PERSON" ? entityId : null,
            legalEntityId: createDialogType === "LEGAL_ENTITY" ? entityId : null,
            addressId: createDialogType === "ADDRESS" ? entityId : null,
            displayLabel
        });
        
        // Refresh bindings just in case
        loadGraphBindings();
    };

    const handleRemoveEntry = async (claimId: string) => {
        setIsSaving(true);
        try {
            const res = await removeMultiValueEntry(clientLEId, fieldNo, claimId);
            if (res.success) {
                toast.success("Value removed");
                setDeletingRowId(null);
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error(res.message || "Failed to remove entry");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
            setDeletingRowId(null);
        }
    };

    const handleInlineEditSave = async (row: any) => {
        if (editingRowValue == null) return;
        setIsSaving(true);
        try {
            // Check if this is a PARTY_REF claim that resolves to a CCParty
            const parsedVal = typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))
                ? (() => { try { return JSON.parse(row.value); } catch { return row.value; } })()
                : row.value;
            const inferredKind = inferClaimValueKind({ valueJson: parsedVal });

            if (inferredKind === 'PARTY_REF' && parsedVal?.ccPartyId) {
                const { upsertCCParty } = await import("@/actions/cc-party-actions");
                const result = await upsertCCParty({
                    id: parsedVal.ccPartyId,
                    clientLEId: clientLEId,
                    data: editingRowValue
                });

                if (result.success) {
                    toast.success("Saved party updated");
                    setEditingRowId(null);
                    setEditingRowValue("");
                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                    setData(refreshed);
                    if (onUpdate && refreshed?.current) {
                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                    }
                } else {
                    toast.error("Failed to update saved party");
                }
            } else if (inferredKind === 'ADDRESS_REF' && parsedVal?.ccAddressId) {
                const { upsertCCAddress } = await import("@/actions/cc-address-actions");
                const result = await upsertCCAddress({
                    id: parsedVal.ccAddressId,
                    clientLEId: clientLEId,
                    data: editingRowValue
                });

                if (result.success) {
                    toast.success("Saved address updated");
                    setEditingRowId(null);
                    setEditingRowValue("");
                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                    setData(refreshed);
                    if (onUpdate && refreshed?.current) {
                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                    }
                } else {
                    toast.error("Failed to update saved address");
                }
            } else {
                const isString = typeof editingRowValue === 'string';
                if (isString && !editingRowValue.trim()) {
                    setIsSaving(false);
                    return;
                }
                const result = await updateFieldManually(
                    clientLEId,
                    fieldNo,
                    isString ? editingRowValue.trim() : editingRowValue,
                    "Inline edit",
                    row.instanceId,
                    'CLIENT_LE'
                );
                if (result.success) {
                    toast.success("Value updated");
                    setEditingRowId(null);
                    setEditingRowValue("");
                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                    setData(refreshed);
                    if (onUpdate && refreshed?.current) {
                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                    }
                } else {
                    toast.error(result.message || "Update failed");
                }
            }
        } catch (e) {
            console.error("Inline edit save error:", e);
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualSave = async () => {
        if (!manualValue) {
            toast.error("A value is required");
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
                result = await updateCustomFieldManually(clientLEId, customFieldId, manualValue, manualReason);
            } else {
                if (!data) {
                    toast.error("Data not loaded");
                    return;
                }
                const parsedVal = typeof data?.current?.value === 'string' && (data.current.value.startsWith('{') || data.current.value.startsWith('['))
                    ? (() => { try { return JSON.parse(data.current.value); } catch { return data.current.value; } })()
                    : data?.current?.value;
                const inferredKind = parsedVal ? inferClaimValueKind({ valueJson: parsedVal }) : null;

                if ((isPersonOrContactField || isCuratedPartyRef) && inferredKind === 'PARTY_REF' && parsedVal?.ccPartyId) {
                    const { upsertCCParty } = await import("@/actions/cc-party-actions");
                    result = await upsertCCParty({
                        id: parsedVal.ccPartyId,
                        clientLEId: clientLEId,
                        data: manualValue
                    });
                } else if ((isAddressField || isCuratedAddressRef) && inferredKind === 'ADDRESS_REF' && parsedVal?.ccAddressId) {
                    const { upsertCCAddress } = await import("@/actions/cc-address-actions");
                    result = await upsertCCAddress({
                        id: parsedVal.ccAddressId,
                        clientLEId: clientLEId,
                        data: manualValue
                    });
                } else {
                    // Determine if we need bulk update
                    const row = data.rows?.find((r: any) => r.id === selectedRowId);
                    const model = data.category;

                    if (row && model && Object.keys(relatedValues).length > 0) {
                        const fieldNameInModel = data.modelField!;
                        const updates = {
                            [fieldNameInModel]: manualValue,
                            ...relatedValues
                        };
                        result = await applyBulkOverride(clientLEId, model, updates, manualReason, selectedRowId!, 'CLIENT_LE');
                    } else {
                        result = await updateFieldManually(clientLEId, fieldNo, manualValue, manualReason, selectedRowId || undefined);
                    }
                }
            }

            if (result.success) {
                toast.success("Field updated successfully");
                setIsEditing(false);
                setManualReason("");
                setRelatedValues({});
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error((result as any).message || "Update failed");
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyCandidate = async (candidate: any) => {
        if (isLocked) {
            toast.error("Cannot apply candidate to a locked question.");
            return;
        }
        if (confirm(`Are you sure you want to apply this value: ${candidate.value}?`)) {
            try {
                const result = await applyCandidate(clientLEId, candidate, selectedRowId || undefined);
                if (result.success) {
                    toast.success("Candidate applied");
                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
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
            const res = await setMasterFieldAssignment(clientLEId, fieldNo, userId);
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
                <SheetHeader className="pb-3 border-b border-slate-100">
                    <SheetTitle className="sr-only">{fieldName}</SheetTitle>
                    <SheetDescription className="sr-only">Details for {fieldName}</SheetDescription>

                    {/* Top row: Context + Assignment */}
                    <div className="flex items-start justify-between mr-8">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                            <div className="flex items-start gap-2.5">
                                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                    {fieldName} <span className="text-slate-400 font-medium text-lg">({fieldNo || customFieldId})</span>
                                </h2>
                            </div>
                            {fieldNo > 0 && (
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                    {data?.category || `Field #${fieldNo}`}
                                </span>
                            )}
                        </div>

                        {/* Assignment */}
                        <div className="shrink-0">
                            {isAssigning ? (
                                <div className="flex items-center px-3 py-1.5 text-xs text-slate-500 gap-2 border rounded-md">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Assigning...
                                </div>
                            ) : (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 shadow-sm group whitespace-nowrap">
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
                                                    <span className="text-xs text-slate-500 group-hover:text-slate-800 transition-colors font-medium">Assign</span>
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
                                            {team.map((user: any) => (
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

                            {isLocked && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 mt-1 h-6">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Locked
                                </Badge>
                            )}
                        </div>
                    </div>
                    {/* Category moved to top */}
                    {customFieldId && fieldNo === 0 && (
                        <div className="flex items-start gap-2.5 mt-3">
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 gap-1 px-1.5 py-0 shrink-0 mt-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                                Custom
                            </Badge>
                            <div className="flex-1 min-w-0">
                                {isRenamingField ? (
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            value={renameFieldValue}
                                            onChange={(e) => setRenameFieldValue(e.target.value)}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    if (!renameFieldValue.trim()) return;
                                                    setIsRenamingSaving(true);
                                                    const res = await renameCustomField(customFieldId, renameFieldValue.trim());
                                                    if (res.success) {
                                                        toast.success("Field renamed");
                                                        setIsRenamingField(false);
                                                        // Refresh data to pick up new name
                                                        const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                        setData(refreshed);
                                                    } else {
                                                        toast.error(res.error || "Rename failed");
                                                    }
                                                    setIsRenamingSaving(false);
                                                }
                                                if (e.key === 'Escape') setIsRenamingField(false);
                                            }}
                                            className="h-7 text-sm flex-1"
                                            autoFocus
                                            disabled={isRenamingSaving}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-green-600"
                                            disabled={isRenamingSaving}
                                            onClick={async () => {
                                                if (!renameFieldValue.trim()) return;
                                                setIsRenamingSaving(true);
                                                const res = await renameCustomField(customFieldId, renameFieldValue.trim());
                                                if (res.success) {
                                                    toast.success("Field renamed");
                                                    setIsRenamingField(false);
                                                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                    setData(refreshed);
                                                } else {
                                                    toast.error(res.error || "Rename failed");
                                                }
                                                setIsRenamingSaving(false);
                                            }}
                                        >
                                            {isRenamingSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setIsRenamingField(false)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                                            {data?.fieldName || customFieldId}
                                        </p>
                                        <button
                                            className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            onClick={() => {
                                                setRenameFieldValue(data?.fieldName || customFieldId || "");
                                                setIsRenamingField(true);
                                            }}
                                            title="Rename custom field"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pr-6 -mr-6 pt-3 space-y-6">

                    {/* ─── Current Value Card ─── */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden shrink-0">
                        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                Current Authoritative Value
                            </div>
                        </div>
                        <div className="p-5">
                            {loading ? (
                                <div className="flex items-center gap-2 text-slate-400 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                </div>
                            ) : (
                                <div>
                                    {data?.isRepeating ? (
                                        <div className="space-y-1">
                                            {/* Count header + collection-level provenance badge */}
                                            {data.rows && data.rows.length > 0 && (
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {data.rows.length} value{data.rows.length !== 1 ? 's' : ''}
                                                    </span>
                                                    {/* Collection-level provenance:
                                                        - "User input" if user has ever added or removed any item
                                                        - Otherwise show the first row's registry source as representative */}
                                                    {data.isUserCurated ? (
                                                        <SourceBadge source="USER_INPUT" registrationAuthorityId={undefined} />
                                                    ) : data.rows[0]?.source ? (
                                                        <SourceBadge source={data.rows[0].source as any} sourceReference={data.rows[0].sourceReference} registrationAuthorityId={registrationAuthorityId} />
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* Code-list fields (controlled vocabulary): delegate entirely to CodeListField */}
                                            {isCodeList ? (
                                                <CodeListField
                                                    clientLEId={clientLEId}
                                                    fieldNo={fieldNo}
                                                    codeSystem={data.codeSystem!}
                                                    rows={data.rows ?? []}
                                                    isUserCurated={data.isUserCurated ?? false}
                                                    isLocked={isLocked}
                                                    onMutate={loadData}
                                                />
                                            ) : (
                                            <>
                                            {/* Value rows */}
                                            {data.rows && data.rows.length > 0 ? (
                                                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
                                                    {data.rows.map((row: any, i: any) => {
                                                        const parsedRowValue = typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))
                                                            ? (() => { try { return JSON.parse(row.value); } catch { return row.value; } })()
                                                            : row.value;

                                                        const inferredKind = inferClaimValueKind({ valueJson: parsedRowValue });
                                                        const isSourceEmbParty = inferredKind === 'EMBEDDED_PARTY' && row.source !== 'USER_INPUT';
                                                        const isUserEmbParty = inferredKind === 'EMBEDDED_PARTY' && row.source === 'USER_INPUT';
                                                        const isUserPartyRef = inferredKind === 'PARTY_REF' && row.source === 'USER_INPUT';
                                                        const isPartyRefValue = inferredKind === 'PARTY_REF';
                                                        const isComplexEditor = inferredKind === 'PARTY_REF' || inferredKind === 'EMBEDDED_PARTY' || inferredKind === 'ADDRESS' || inferredKind === 'ADDRESS_REF';
                                                        
                                                        const showPromote = inferredKind === 'EMBEDDED_PARTY' || inferredKind === 'ADDRESS';
                                                        const isReadOnlySource = row.source !== 'USER_INPUT';
                                                        const canEdit = !isReadOnlySource;
                                                        const canRemove = !isReadOnlySource;

                                                        return (
                                                        <div key={row.id}>
                                                            {/* Delete confirmation mode */}
                                                            {deletingRowId === row.id ? (
                                                                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 animate-in fade-in duration-150">
                                                                    <span className="text-xs text-red-700 font-medium truncate flex-1 flex items-center gap-1">
                                                                        {isPartyRefValue ? (
                                                                            <span>Break link to "{row.data?.resolvedSummary || (typeof row.value === 'object' && row.value?.ccPartyId) || 'saved party'}"?</span>
                                                                        ) : (
                                                                            <>
                                                                                Remove "{renderRowValue(row.value, row)}"?
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 px-2 text-[11px] text-red-700 hover:bg-red-100 hover:text-red-800"
                                                                            onClick={() => handleRemoveEntry(row.id)}
                                                                            disabled={isSaving}
                                                                        >
                                                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : isPartyRefValue ? 'Yes, break link' : 'Yes, remove'}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 px-2 text-[11px] text-slate-500 hover:bg-slate-100"
                                                                            onClick={() => setDeletingRowId(null)}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : editingRowId === row.id ? (
                                                                /* Inline edit mode */
                                                                <div className={cn(
                                                                    "px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 animate-in fade-in duration-150",
                                                                    isComplexEditor ? "flex flex-col gap-3 flex-1" : "flex items-center gap-1.5"
                                                                )}>
                                                                    {isObjectRef ? (
                                                                        <div className="flex-1">
                                                                            <GraphNodePicker
                                                                                clientLEId={clientLEId}
                                                                                graphNodeType={graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS")}
                                                                                filterEdgeType={graphBindings.find(b => b.isActive)?.filterEdgeType}
                                                                                allowCreate={graphBindings.find(b => b.isActive)?.allowCreate ?? true}
                                                                                pickerLabel={graphBindings.find(b => b.isActive)?.pickerLabel || (isPartyRef ? "Select Party" : "Select Address")}
                                                                                pickerConfig={graphBindings.find(b => b.isActive)?.pickerConfig ?? null}
                                                                                isMultiValue={false}
                                                                                selectedNodeIds={currentSelectionIds}
                                                                                disabled={isAddingSaving || isLoadingBindings}
                                                                                className="border-slate-400 bg-white"
                                                                                onSelect={(item) => handleGraphNodeSelect(item, row.instanceId)}
                                                                                onCreateNew={() => handleCreateNewNode(graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS"))}
                                                                            />
                                                                        </div>
                                                                    ) : inferredKind === 'PARTY_REF' ? (
                                                                        <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                                                                            <PersonOrContactValueEditor
                                                                                value={editingRowValue || { contactType: 'PERSON', roles: [] } as any}
                                                                                onChange={setEditingRowValue}
                                                                                disabled={isSaving}
                                                                                fieldNo={fieldNo}
                                                                            />
                                                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 bg-slate-50/50">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-xs bg-white text-slate-700 border-slate-200"
                                                                                    onClick={() => { setEditingRowId(null); setEditingRowValue(""); }}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                                                                    onClick={() => handleInlineEditSave(row)}
                                                                                    disabled={isSaving || !isValidPartyValue(editingRowValue)}
                                                                                >
                                                                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                                                                    Save
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : inferredKind === 'EMBEDDED_PARTY' ? (
                                                                        <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                                                                            <PersonOrContactValueEditor
                                                                                value={editingRowValue || { contactType: 'PERSON', roles: [] } as any}
                                                                                onChange={setEditingRowValue}
                                                                                disabled={isSaving}
                                                                                fieldNo={fieldNo}
                                                                            />
                                                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 bg-slate-50/50">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-xs bg-white text-slate-700 border-slate-200"
                                                                                    onClick={() => { setEditingRowId(null); setEditingRowValue(""); }}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                                                                    onClick={() => handleInlineEditSave(row)}
                                                                                    disabled={isSaving || !isValidPartyValue(editingRowValue)}
                                                                                >
                                                                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                                                                    Save
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : inferredKind === 'ADDRESS_REF' || inferredKind === 'ADDRESS' ? (
                                                                        <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                                                                            <AddressValueEditor
                                                                                value={editingRowValue || {} as any}
                                                                                onChange={setEditingRowValue}
                                                                                disabled={isSaving}
                                                                            />
                                                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 bg-slate-50/50">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-xs bg-white text-slate-700 border-slate-200"
                                                                                    onClick={() => { setEditingRowId(null); setEditingRowValue(""); }}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                                                                    onClick={() => handleInlineEditSave(row)}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                                                                    Save
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        data?.options && data.options.length > 0 ? (
                                                                            <Select
                                                                                value={editingRowValue}
                                                                                onValueChange={setEditingRowValue}
                                                                                disabled={isSaving}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-sm flex-1 bg-white border-indigo-200 focus:border-indigo-400">
                                                                                    <SelectValue placeholder="Select a value..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent position="item-aligned">
                                                                                    {data.options.map((opt) => {
                                                                                        const v = typeof opt === 'object' ? opt.value : opt;
                                                                                        const l = typeof opt === 'object' ? opt.label : opt;
                                                                                        return <SelectItem key={v} value={v}>{l}</SelectItem>;
                                                                                    })}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <Input
                                                                                type={isDateType ? 'date' : 'text'}
                                                                                value={isDateType ? formatDateForInput(editingRowValue) : editingRowValue}
                                                                                onChange={(e) => setEditingRowValue(isDateType ? parseDateFromInput(e.target.value) : e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter' && editingRowValue.trim()) handleInlineEditSave(row);
                                                                                    if (e.key === 'Escape') { setEditingRowId(null); setEditingRowValue(""); }
                                                                                }}
                                                                                className="h-8 text-sm flex-1 bg-white border-indigo-200 focus:border-indigo-400"
                                                                                autoFocus
                                                                                disabled={isSaving}
                                                                            />
                                                                        )
                                                                    )}
                                                                    {!isObjectRef && !isComplexEditor && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-green-600 hover:bg-green-50"
                                                                            onClick={() => handleInlineEditSave(row)}
                                                                            disabled={isSaving || (typeof editingRowValue === 'string' ? !editingRowValue.trim() : ((inferredKind as any) === 'EMBEDDED_PARTY' && !isValidPartyValue(editingRowValue)))}
                                                                        >
                                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                    )}
                                                                    {!isComplexEditor && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-slate-400 hover:bg-slate-100"
                                                                            onClick={() => { setEditingRowId(null); setEditingRowValue(""); }}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                /* Normal display row */
                                                                <div className="group flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-150 bg-white hover:border-slate-300 hover:shadow-sm transition-all">
                                                                    <div className="flex-1 min-w-0">
                                                                        {/* Structured collection row (e.g. Field 5 Previous Names) */}
                                                                        {(() => {
                                                                            if (parsedRowValue && typeof parsedRowValue === 'object' && (parsedRowValue.name || isPersonOrContactValue(parsedRowValue))) {
                                                                                return <CollectionRowDisplay fieldNo={fieldNo} row={parsedRowValue} />;
                                                                            }
                                                                            return (
                                                                                <div className="text-sm font-medium text-slate-900 truncate">
                                                                                    {renderRowValue(row.value, row)}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <SourceBadge source={row.source as any} sourceReference={row.sourceReference} registrationAuthorityId={registrationAuthorityId} />
                                                                            <span className="text-[9px] text-slate-400">
                                                                                {row.timestamp ? new Date(row.timestamp).toLocaleDateString() : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {!isLocked && (
                                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                                            {showPromote && (
                                                                                row.isPromotedToCCC ? (
                                                                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 mr-2 hover:bg-emerald-50 font-medium h-6" title="A reusable copy already exists for this item.">
                                                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                        Saved for reuse
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 mr-2"
                                                                                        onClick={() => handleSaveForReuse(row.id, inferredKind!)}
                                                                                        disabled={isPromoting === row.id}
                                                                                        title="Create a reusable copy without changing the source data."
                                                                                    >
                                                                                        {isPromoting === row.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                                                                                        Save for reuse
                                                                                    </Button>
                                                                                )
                                                                            )}
                                                                            {canEdit && (
                                                                                <button
                                                                                    className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                                                    onClick={() => {
                                                                                        if (isObjectRef) {
                                                                                            handleEditNode(row);
                                                                                        } else {
                                                                                            setEditingRowId(row.id);
                                                                                            if (inferredKind === 'PARTY_REF') {
                                                                                                setEditingRowValue(row.data?.ccParty?.data || row.data?._resolvedData?.ccParty?.data || parsedRowValue);
                                                                                            } else if (inferredKind === 'ADDRESS_REF') {
                                                                                                setEditingRowValue(row.data?.ccAddress?.data || row.data?._resolvedData?.ccAddress?.data || parsedRowValue);
                                                                                            } else {
                                                                                                setEditingRowValue(parsedRowValue);
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                    title="Edit value"
                                                                                >
                                                                                    <Pencil className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                            {canRemove && (
                                                                                <button
                                                                                    className={cn(
                                                                                        "p-1.5 rounded text-slate-400 transition-colors",
                                                                                        isPartyRefValue 
                                                                                            ? "hover:bg-indigo-50 hover:text-indigo-600" 
                                                                                            : "hover:bg-red-50 hover:text-red-500"
                                                                                    )}
                                                                                    onClick={() => setDeletingRowId(row.id)}
                                                                                    title={isPartyRefValue ? "Break link to saved party" : "Remove value"}
                                                                                >
                                                                                    {isPartyRefValue ? (
                                                                                        <Link2Off className="h-3.5 w-3.5" />
                                                                                    ) : (
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    )}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                /* Empty state */
                                                <div className="text-center py-4">
                                                    <p className="text-sm text-slate-400 italic">No values recorded yet</p>
                                                </div>
                                            )}

                                            {/* Persistent add input */}
                                            {!isLocked && (
                                                <div className="pt-3 mt-2 border-t border-slate-100">
                                                    {isObjectRef ? (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setAddDialogOpen(true)}
                                                            className="w-full justify-center bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed"
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Add {graphBindings.find(b => b.isActive)?.pickerLabel?.replace('Select ', '') || (isPartyRef ? "Party" : "Address")}
                                                        </Button>
                                                    ) : isCuratedPartyRef ? (
                                                        <div>
                                                            {!isAddingPerson ? (
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setIsAddingPerson(true);
                                                                        setNewPersonData(null);
                                                                    }}
                                                                    className="w-full justify-center bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed"
                                                                >
                                                                    <Plus className="h-4 w-4 mr-2" />
                                                                    Add saved party
                                                                </Button>
                                                            ) : (
                                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                                                                    <PartyRefValueEditor
                                                                        value={newPersonData}
                                                                        onChange={setNewPersonData}
                                                                        clientLEId={clientLEId}
                                                                        disabled={isAddingSaving}
                                                                    />
                                                                    <div className="flex items-center gap-2 pt-2">
                                                                        <Button size="sm" onClick={() => handleAddNewEntry(newPersonData)} disabled={isAddingSaving || !newPersonData?.ccPartyId}>
                                                                            {isAddingSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                                                            Save
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" onClick={() => { setIsAddingPerson(false); setNewPersonData(null); }} disabled={isAddingSaving}>
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isPersonOrContactField ? (
                                                        <div className="pt-2">
                                                            <UnifiedPartyPicker
                                                                clientLEId={clientLEId}
                                                                fieldNo={fieldNo}
                                                                onSuccess={async () => {
                                                                    setNewEntryValue("");
                                                                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                    setData(refreshed);
                                                                    if (onUpdate && refreshed?.current) {
                                                                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    ) : isAddressField ? (
                                                        <div className="pt-2">
                                                            <UnifiedAddressPicker
                                                                clientLEId={clientLEId}
                                                                fieldNo={fieldNo}
                                                                onSuccess={async () => {
                                                                    setNewEntryValue("");
                                                                    const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                    setData(refreshed);
                                                                    if (onUpdate && refreshed?.current) {
                                                                        onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            {data?.options && data.options.length > 0 ? (
                                                                <>
                                                                    <Select
                                                                        value={newEntryValue}
                                                                        onValueChange={setNewEntryValue}
                                                                        disabled={isAddingSaving}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-sm flex-1 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-indigo-300">
                                                                            <SelectValue placeholder="Select a value..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent position="item-aligned">
                                                                            {data.options.map((opt) => {
                                                                                const v = typeof opt === 'object' ? opt.value : opt;
                                                                                const l = typeof opt === 'object' ? opt.label : opt;
                                                                                return <SelectItem key={v} value={v}>{l}</SelectItem>;
                                                                            })}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 px-3 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
                                                                        onClick={() => handleAddNewEntry()}
                                                                        disabled={isAddingSaving || !newEntryValue.trim()}
                                                                    >
                                                                        {isAddingSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="relative flex-1">
                                                                        <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                                        <Input
                                                                            ref={newEntryInputRef}
                                                                            type={isDateType ? 'date' : 'text'}
                                                                            value={isDateType ? formatDateForInput(newEntryValue) : newEntryValue}
                                                                            onChange={(e) => setNewEntryValue(isDateType ? parseDateFromInput(e.target.value) : e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && newEntryValue.trim()) handleAddNewEntry();
                                                                            }}
                                                                            placeholder={isDateType ? '' : 'Add new value...'}
                                                                            className="h-8 text-sm pl-8 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-indigo-300"
                                                                            disabled={isAddingSaving}
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 px-3 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
                                                                        onClick={() => handleAddNewEntry()}
                                                                        disabled={isAddingSaving || !newEntryValue.trim()}
                                                                    >
                                                                        {isAddingSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            </> /* closes isCodeList ternary else */
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            {/* Value Display / Inline Edit for Empty */}
                                            {data?.current?.value != null && data.current.value !== '' ? (
                                                !isEditing ? (
                                                    <div>
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1 mt-0.5">
                                                                <div className="text-base font-medium text-slate-900 break-all leading-relaxed">
                                                                    {isAddressValue(data.current.value) || (data.current.value && typeof data.current.value === 'object' && 'ccAddressId' in data.current.value) ? (
                                                                         <AddressValueViewer value={data.current.value?._resolvedData?.ccAddress?.data || data.current.value} layout="detailed" />
                                                                     ) : (isPersonOrContactValue(data.current.value) || (data.current.value && typeof data.current.value === 'object' && 'ccPartyId' in data.current.value)) ? (
                                                                         <PersonOrContactValueViewer value={data.current.value?._resolvedData?.ccParty?.data || data.current.value} layout="detailed" />
                                                                    ) : Array.isArray(data.current.value) ? (
                                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                                            {data.current.value.map((v: any, idx: number) => (
                                                                                <Badge key={idx} variant="outline" className="bg-white border-slate-300 text-slate-800 py-1 px-2.5 text-sm shadow-sm ring-1 ring-slate-100/50">
                                                                                    {renderRowValue(v)}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        // Use renderRowValue to handle JSONB objects (e.g. {code, label} SIC codes)
                                                                        // instead of String() which produces [object Object]
                                                                        renderRowValue(data.current.value)
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 flex items-center gap-2">
                                                                    <SourceBadge source={data.current.source || 'UNKNOWN'} sourceReference={data.current.sourceReference} registrationAuthorityId={registrationAuthorityId} />
                                                                    <span className="text-[10px] text-slate-400">
                                                                        Updated: {data.current.timestamp ? new Date(data.current.timestamp).toLocaleString() : 'Never'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                             {!isLocked && (
                                                                 isPersonOrContactField || isCuratedPartyRef ? (
                                                                     <div className="flex items-center gap-1.5 shrink-0">
                                                                         {isCuratedPartyRef || data?.current?.source === 'USER_INPUT' ? (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                 onClick={() => {
                                                                                     setManualValue(data?.current?.value?._resolvedData?.ccParty?.data || data?.current?.value || {
                                                                                         contactType: "PERSON",
                                                                                         title: null,
                                                                                         forenames: null,
                                                                                         surname: null,
                                                                                         email: null,
                                                                                         phones: [],
                                                                                         nationality: [],
                                                                                         countryOfResidence: null,
                                                                                         dateOfBirth: null,
                                                                                         placeOfBirth: null,
                                                                                         roles: [],
                                                                                         sourceIdentifiers: [],
                                                                                         isActivePersonOrContact: null,
                                                                                         visibility: { scope: "CLIENT_LE" }
                                                                                     } as any);
                                                                                     setIsEditing(true);
                                                                                     setRelatedValues({});
                                                                                 }}
                                                                                 title={isCuratedPartyRef ? "Edit saved party" : "Edit value"}
                                                                             >
                                                                                 <Pencil className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         ) : (
                                                                             data?.current?.isPromotedToCCC ? (
                                                                                 <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium h-6" title="A reusable copy already exists for this item.">
                                                                                     <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                     Saved for reuse
                                                                                 </Badge>
                                                                             ) : (
                                                                                 <Button
                                                                                     variant="ghost"
                                                                                     size="sm"
                                                                                     className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                                                                     disabled={isPromoting === data?.current?.claimId}
                                                                                     onClick={() => data?.current?.claimId && handleSaveForReuse(data.current.claimId, 'EMBEDDED_PARTY')}
                                                                                     title="Create a reusable copy without changing the source data."
                                                                                 >
                                                                                     {isPromoting === data?.current?.claimId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                                                                                     Save for reuse
                                                                                 </Button>
                                                                             )
                                                                         )}
                                                                         {data?.current?.source === 'USER_INPUT' && (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                 onClick={() => setIsClearingSingleValue(true)}
                                                                                 title="Break link to party reference"
                                                                             >
                                                                                 <Link2Off className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         )}
                                                                         {isCuratedPartyRef && (
                                                                             <UnifiedPartyPicker
                                                                                 clientLEId={clientLEId}
                                                                                 fieldNo={fieldNo}
                                                                                 onSuccess={async () => {
                                                                                     const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                     setData(refreshed);
                                                                                     if (onUpdate && refreshed?.current) {
                                                                                         onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                     }
                                                                                 }}
                                                                                 trigger={
                                                                                     <button
                                                                                         className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                         title="Change saved party"
                                                                                     >
                                                                                         <ArrowRightLeft className="h-3.5 w-3.5" />
                                                                                     </button>
                                                                                 }
                                                                             />
                                                                         )}
                                                                     </div>
                                                                 ) : isAddressField || isCuratedAddressRef ? (
                                                                     <div className="flex items-center gap-1.5 shrink-0">
                                                                         {isCuratedAddressRef || data?.current?.source === 'USER_INPUT' ? (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                 onClick={() => {
                                                                                     setManualValue(data?.current?.value?._resolvedData?.ccAddress?.data || data?.current?.value || { addressLines: [] });
                                                                                     setIsEditing(true);
                                                                                     setRelatedValues({});
                                                                                 }}
                                                                                 title={isCuratedAddressRef ? "Edit saved address" : "Edit value"}
                                                                             >
                                                                                 <Pencil className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         ) : (
                                                                             data?.current?.isPromotedToCCC ? (
                                                                                 <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium h-6" title="A reusable copy already exists for this item.">
                                                                                     <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                     Saved for reuse
                                                                                 </Badge>
                                                                             ) : (
                                                                                 <Button
                                                                                     variant="ghost"
                                                                                     size="sm"
                                                                                     className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                                                                     disabled={isPromoting === data?.current?.claimId}
                                                                                     onClick={() => data?.current?.claimId && handleSaveForReuse(data.current.claimId, 'ADDRESS')}
                                                                                     title="Create a reusable copy without changing the source data."
                                                                                 >
                                                                                     {isPromoting === data?.current?.claimId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                                                                                     Save for reuse
                                                                                 </Button>
                                                                             )
                                                                         )}
                                                                         {data?.current?.source === 'USER_INPUT' && (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                 onClick={() => setIsClearingSingleValue(true)}
                                                                                 title="Break link to address reference"
                                                                             >
                                                                                 <Link2Off className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         )}
                                                                         {isCuratedAddressRef && (
                                                                             <UnifiedAddressPicker
                                                                                 clientLEId={clientLEId}
                                                                                 fieldNo={fieldNo}
                                                                                 onSuccess={async () => {
                                                                                     const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                     setData(refreshed);
                                                                                     if (onUpdate && refreshed?.current) {
                                                                                         onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                     }
                                                                                 }}
                                                                                 trigger={
                                                                                     <button
                                                                                         className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                         title="Change saved address"
                                                                                     >
                                                                                         <ArrowRightLeft className="h-3.5 w-3.5" />
                                                                                     </button>
                                                                                 }
                                                                             />
                                                                         )}
                                                                     </div>
                                                                 ) : (
                                                                     <button
                                                                         className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                         onClick={() => {
                                                                             setManualValue(String(data?.current?.value || ""));
                                                                             setIsEditing(true);
                                                                             setRelatedValues({});
                                                                         }}
                                                                         title="Edit value"
                                                                     >
                                                                         <Pencil className="h-3.5 w-3.5" />
                                                                     </button>
                                                                 )
                                                             )}
                                                         </div>
                                                         {isClearingSingleValue && (
                                                             <div className="mt-4 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 animate-in fade-in duration-150">
                                                                 <span className="text-xs text-red-700 font-medium truncate flex-1">
                                                                     Break link to party reference?
                                                                 </span>
                                                                 <div className="flex items-center gap-1.5 shrink-0">
                                                                     <Button
                                                                         variant="ghost"
                                                                         size="sm"
                                                                         className="h-6 px-2 text-[11px] text-red-700 hover:bg-red-100 hover:text-red-800"
                                                                         onClick={async () => {
                                                                             setIsSaving(true);
                                                                             try {
                                                                                 const result = await updateFieldManually(clientLEId, fieldNo, null, "Break party link", undefined, 'CLIENT_LE');
                                                                                 if (result.success) {
                                                                                     toast.success("Party link broken");
                                                                                     setIsClearingSingleValue(false);
                                                                                     const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                     setData(refreshed);
                                                                                     if (onUpdate && refreshed?.current) {
                                                                                         onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                     }
                                                                                 } else {
                                                                                     toast.error("Failed to break link");
                                                                                 }
                                                                             } catch (err) {
                                                                                 toast.error("An error occurred");
                                                                             } finally {
                                                                                 setIsSaving(false);
                                                                             }
                                                                         }}
                                                                         disabled={isSaving}
                                                                     >
                                                                         {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, break link'}
                                                                     </Button>
                                                                     <Button
                                                                         variant="ghost"
                                                                         size="sm"
                                                                         className="h-6 px-2 text-[11px] text-slate-500 hover:bg-slate-100"
                                                                         onClick={() => setIsClearingSingleValue(false)}
                                                                         disabled={isSaving}
                                                                     >
                                                                         Cancel
                                                                     </Button>
                                                                 </div>
                                                             </div>
                                                         )}
                                                     </div>
                                                 ) : null
                                            ) : (
                                                /* Empty state — show state-aware display first, then inline input */
                                                <div className="flex items-start gap-3 mt-2">
                                                    <div className="flex-1 space-y-2">
                                                         {!isEditing ? (
                                                             isCuratedPartyRef || isPersonOrContactField ? (
                                                                 <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 p-4 space-y-3">
                                                                     <div className="text-sm text-slate-500 italic">
                                                                         {isCuratedPartyRef ? "No saved party assigned" : "No person/contact recorded"}
                                                                     </div>
                                                                     {!isLocked && (
                                                                         <UnifiedPartyPicker
                                                                             clientLEId={clientLEId}
                                                                             fieldNo={fieldNo}
                                                                             onSuccess={async () => {
                                                                                 const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                 setData(refreshed);
                                                                                 if (onUpdate && refreshed?.current) {
                                                                                     onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                 }
                                                                             }}
                                                                             trigger={
                                                                                 <Button
                                                                                     variant="outline"
                                                                                     className="bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed shadow-sm shrink-0"
                                                                                 >
                                                                                     <Plus className="h-4 w-4 mr-2" />
                                                                                     {isCuratedPartyRef ? "Select saved party" : (fieldNo === 63 ? 'Add Director' : 'Select Party / Contact')}
                                                                                 </Button>
                                                                             }
                                                                         />
                                                                     )}
                                                                 </div>
                                                             ) : isAddressField ? (
                                                                 <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 p-4 space-y-3">
                                                                     <div className="text-sm text-slate-500 italic">
                                                                         No address recorded
                                                                     </div>
                                                                     {!isLocked && (
                                                                         <UnifiedAddressPicker
                                                                             clientLEId={clientLEId}
                                                                             fieldNo={fieldNo}
                                                                             onSuccess={async () => {
                                                                                 const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                 setData(refreshed);
                                                                                 if (onUpdate && refreshed?.current) {
                                                                                     onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                 }
                                                                             }}
                                                                         />
                                                                     )}
                                                                 </div>
                                                             ) : (
                                                                <div className="relative">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="mt-0.5">
                                                                        <div className="text-sm text-slate-500 italic mb-2">
                                                                            {data?.displayState === 'MAPPED_NOT_CHECKED' && 'Source not checked yet'}
                                                                            {data?.displayState === 'CHECKED_NO_DATA' && 'No data in source record'}
                                                                            {data?.displayState === 'DEFAULT_RESPONSE' && (
                                                                                <span className="flex items-center gap-2 not-italic text-slate-800">
                                                                                    <span>{data.defaultResponse}</span>
                                                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-slate-500 bg-slate-50 border-slate-200">Field Default</Badge>
                                                                                </span>
                                                                            )}
                                                                            {(!data?.displayState || data?.displayState === 'UNMAPPED_NO_RESPONSE') && 'No response recorded'}
                                                                        </div>
                                                                        {(data?.displayState === 'MAPPED_NOT_CHECKED' || data?.displayState === 'CHECKED_NO_DATA') && data?.current?.source && (
                                                                            <div className="mt-2 flex items-center gap-2">
                                                                                <SourceBadge source={data.current.source} registrationAuthorityId={registrationAuthorityId} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!isLocked && (
                                                                        <button
                                                                            className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                            onClick={() => setIsEditing(true)}
                                                                            title="Add value"
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                </div>
                                                            )
                                                        ) : !isLocked ? (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Add Value</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-auto p-0 text-[10px] text-slate-500 hover:bg-transparent hover:underline"
                                                                        onClick={() => setIsEditing(false)}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                                {isObjectRef ? (
                                                                    <GraphNodePicker
                                                                        clientLEId={clientLEId}
                                                                        graphNodeType={graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS")}
                                                                        filterEdgeType={graphBindings.find(b => b.isActive)?.filterEdgeType}
                                                                        filterActiveOnly={graphBindings.find(b => b.isActive)?.filterActiveOnly ?? true}
                                                                        allowCreate={graphBindings.find(b => b.isActive)?.allowCreate ?? true}
                                                                        pickerLabel={graphBindings.find(b => b.isActive)?.pickerLabel || (isPartyRef ? "Select Party" : "Select Address")}
                                                                        pickerConfig={graphBindings.find(b => b.isActive)?.pickerConfig ?? null}
                                                                        isMultiValue={false}
                                                                        selectedNodeIds={currentSelectionIds}
                                                                        disabled={isAddingSaving || isLoadingBindings}
                                                                        className="border-slate-300 bg-slate-50/50"
                                                                        onSelect={handleGraphNodeSelect}
                                                                        onCreateNew={() => handleCreateNewNode(graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS"))}
                                                                    />
                                                                ) : (
                                                                    <>
                                                                        {isAddressField ? (
                                                                            <div className="mt-4">
                                                                                <UnifiedAddressPicker
                                                                                    clientLEId={clientLEId}
                                                                                    fieldNo={fieldNo}
                                                                                    onSuccess={async () => {
                                                                                        setIsEditing(false);
                                                                                        const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                                                                                        setData(refreshed);
                                                                                        if (onUpdate && refreshed?.current) {
                                                                                            onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        ) : isCuratedPartyRef || isPersonOrContactField ? (
                                                                             <div className="mt-4 bg-slate-50 p-2 rounded border border-slate-200">
                                                                                 <PersonOrContactValueEditor
                                                                                     value={typeof manualValue === 'object' && manualValue ? manualValue : { contactType: 'PERSON', roles: [] } as any}
                                                                                     onChange={(val) => setManualValue(val as any)}
                                                                                     disabled={isSaving}
                                                                                     fieldNo={fieldNo}
                                                                                 />
                                                                                <div className="flex items-center gap-2 mt-2">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                                                        onClick={() => {
                                                                                            setIsEditing(true);
                                                                                            handleManualSave();
                                                                                        }}
                                                                                        disabled={isSaving || !isValidPartyValue(manualValue)}
                                                                                    >
                                                                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                                        Save
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ) : data?.options && data.options.length > 0 ? (
                                                                            <div className="space-y-2">
                                                                                <Select value={manualValue} onValueChange={(v) => setManualValue(v)}>
                                                                                    <SelectTrigger className="bg-white border-slate-200 focus:border-indigo-300">
                                                                                        <SelectValue placeholder={`Select ${fieldName}...`} />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent position="item-aligned">
                                                                                        {data.options.map((opt) => {
                                                                                            const v = typeof opt === 'object' ? opt.value : opt;
                                                                                            const l = typeof opt === 'object' ? opt.label : opt;
                                                                                            return <SelectItem key={v} value={v}>{l}</SelectItem>;
                                                                                        })}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                {manualValue && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                                                            onClick={() => { setIsEditing(true); handleManualSave(); }}
                                                                                            disabled={isSaving}
                                                                                        >
                                                                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                                            Save
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <Input
                                                                                    type={isDateType ? 'date' : 'text'}
                                                                                    value={isDateType ? formatDateForInput(manualValue) : manualValue}
                                                                                    onChange={(e) => setManualValue(isDateType ? parseDateFromInput(e.target.value) : e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && manualValue) {
                                                                                            setIsEditing(true);
                                                                                            handleManualSave();
                                                                                        }
                                                                                    }}
                                                                                    placeholder={isDateType ? '' : 'Type a value and press Enter...'}
                                                                                    className="bg-white border-slate-200 focus:border-indigo-300 focus:ring-indigo-200"
                                                                                />
                                                                                {manualValue && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                                                            onClick={() => {
                                                                                                setIsEditing(true);
                                                                                                handleManualSave();
                                                                                            }}
                                                                                            disabled={isSaving}
                                                                                        >
                                                                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                                            Save
                                                                                        </Button>
                                                                                        <span className="text-[10px] text-slate-400">or press Enter</span>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[13px] text-slate-400 italic mt-2">No value provided.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Explicit Edit Mode (when editing an existing value) */}
                            {isEditing && !data?.isRepeating && data?.current?.value != null && data.current.value !== '' && (
                                <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        {selectedRowId && (
                                            <div className="bg-indigo-50 p-2 rounded text-[10px] font-medium text-indigo-700 flex items-center justify-between">
                                                <span>
                                                    EDITING ENTRY: {data?.rows?.find((r: any) => r.id === selectedRowId)?.label || "Specific Row"}
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
                                                 {isCuratedPartyRef || isPersonOrContactField ? (
                                                     <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                         <PersonOrContactValueEditor
                                                             value={typeof manualValue === 'object' && manualValue ? manualValue : { contactType: 'PERSON', roles: [] } as any}
                                                             onChange={(val) => setManualValue(val as any)}
                                                             disabled={isSaving}
                                                             fieldNo={fieldNo}
                                                         />
                                                     </div>
                                                ) : isAddressField || isCuratedAddressRef ? (
                                                     <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                         <AddressValueEditor
                                                             value={typeof manualValue === 'object' && manualValue ? manualValue : { addressLines: [] } as any}
                                                             onChange={(val) => setManualValue(val as any)}
                                                             disabled={isSaving}
                                                         />
                                                     </div>
                                                ) : data?.options && data.options.length > 0 ? (
                                                    <Select value={manualValue} onValueChange={setManualValue}>
                                                        <SelectTrigger className="w-full bg-white border-slate-300">
                                                            <SelectValue placeholder={`Select ${fieldName}...`} />
                                                        </SelectTrigger>
                                                        <SelectContent position="item-aligned">
                                                            {data.options.map((opt) => {
                                                                const v = typeof opt === 'object' ? opt.value : opt;
                                                                const l = typeof opt === 'object' ? opt.label : opt;
                                                                return <SelectItem key={v} value={v}>{l}</SelectItem>;
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                ) : isDateType ? (
                                                    <Input
                                                        type="date"
                                                        value={formatDateForInput(manualValue)}
                                                        onChange={(e) => setManualValue(parseDateFromInput(e.target.value))}
                                                        className="bg-white border-slate-300"
                                                    />
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
                                    {selectedRowId && (data?.fieldNo === 62 || data?.fieldNo === 64) && (
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
                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-tight">Audit Notes (Optional)</label>
                                        <Textarea
                                            value={manualReason}
                                            onChange={(e) => setManualReason(e.target.value)}
                                            placeholder="Add notes about this override (optional)..."
                                            className="h-24 bg-white border-slate-300 focus:ring-indigo-500 shadow-sm"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                         <Button
                                             size="sm"
                                             onClick={handleManualSave}
                                             disabled={isSaving || ((isPersonOrContactField || isCuratedPartyRef) && !isValidPartyValue(manualValue))}
                                         >
                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle className="h-3 w-3 mr-2" />}
                                            Save Override
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div> {/* Closes the p-5 inner padding div */}

                        {/* ─── Attached Evidence (Part of Answer) ─── */}
                        <div className="bg-slate-50/50 border-t border-slate-100 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                                    <Paperclip className="w-3.5 h-3.5" /> Documents
                                </span>
                                <div className="flex items-center gap-2">
                                    {evidenceDocs.length > 0 && (
                                        <Badge variant="secondary" className="bg-white text-slate-500 text-[10px] border-slate-200">
                                            {evidenceDocs.length}
                                        </Badge>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        disabled={isUploadingEvidence}
                                        onChange={handleEvidenceUpload}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] bg-white text-indigo-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-700"
                                        disabled={isUploadingEvidence}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {isUploadingEvidence ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} Attach Document
                                    </Button>
                                </div>
                            </div>

                            {isLoadingEvidence ? (
                                <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading documents...
                                </div>
                            ) : evidenceDocs.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 bg-white rounded-lg border border-slate-100 border-dashed">
                                    <p className="text-xs italic">No documents attached.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    {evidenceDocs.map((doc: any) => (
                                        <div key={doc.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 group transition-colors">
                                            <div className="h-8 w-8 rounded bg-indigo-50 flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
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
                        </div>
                    </div> {/* Closes the rounded-xl "Current Value Card" div */}

                    <Tabs defaultValue="history" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="history">History Log</TabsTrigger>
                            <TabsTrigger value="note">Notes</TabsTrigger>
                        </TabsList>

                        {/* ─── Notes Tab ─── */}
                        <TabsContent value="note" className="mt-4">
                            <div className="flex flex-col h-full rounded-md border p-4 bg-slate-50/50">
                                <label className="text-xs font-semibold text-slate-600 mb-2 block uppercase tracking-tight">
                                    Field Note (Internal Only)
                                </label>
                                <Textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value.slice(0, 1000))}
                                    placeholder="Add a scratchpad note for this field..."
                                    className="flex-1 min-h-[220px] resize-none text-sm bg-white border-slate-200 focus:ring-indigo-500 shadow-sm"
                                    disabled={isLocked || isSavingNote}
                                />
                                <div className="flex justify-between items-center mt-3 text-xs text-slate-400">
                                    <span>{noteText.length} / 1000 characters</span>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveNote}
                                        disabled={isLocked || isSavingNote || noteText === (data?.userNote || "")}
                                        className="h-8"
                                    >
                                        {isSavingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                        Save Note
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ─── History Tab ─── */}
                        <TabsContent value="history" className="mt-4">
                            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                                <div className="relative border-l border-slate-200 ml-3 space-y-6">
                                    {data?.history && data.history.length > 0 ? (
                                        data.history.map((item: any) => (
                                            <div key={item.id} className="relative pl-6">
                                                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white" />
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                                                        <span>•</span>
                                                        <span className="font-medium text-slate-700">{item.actorId || "System"}</span>
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        Changed value to <span className="font-mono bg-slate-100 px-1 rounded">{renderRowValue(item.newValue)}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                                        via <SourceBadge source={item.source} sourceReference={item.actor} registrationAuthorityId={registrationAuthorityId} />
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
                    </Tabs>

                    {/* ─── Suggestions Section ─── */}
                    <div className="mt-4 pt-4 border-t border-slate-200 shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Database className="w-4 h-4 text-slate-400" />
                                Suggestions
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-normal text-slate-400">
                                {data?.candidates?.length || 0} Persisted
                            </Badge>
                        </div>

                        {data?.candidates && data.candidates.length > 0 ? (
                            <ScrollArea className="h-[200px] w-full border rounded-md p-3 bg-slate-50/30">
                                <div className="space-y-3">
                                    {data.candidates.sort((a, b) => (a.isAuthoritative === b.isAuthoritative ? 0 : a.isAuthoritative ? -1 : 1)).map((candidate: any) => (
                                        <div 
                                            key={candidate.id} 
                                            className={cn(
                                                "p-3 rounded-lg border transition-all",
                                                candidate.isAuthoritative 
                                                    ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100" 
                                                    : "bg-white border-slate-100 hover:border-slate-200"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <SourceBadge source={candidate.source} sourceReference={candidate.sourceReference} registrationAuthorityId={registrationAuthorityId} />
                                                        {candidate.isAuthoritative && (
                                                            <Badge className="bg-indigo-600 text-white text-[9px] h-4 px-1.5 border-none">
                                                                Current Authoritative
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-semibold text-slate-900 break-all mb-1">
                                                        {renderRowValue(candidate.value)}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <History className="w-3 h-3" />
                                                            {new Date(candidate.timestamp).toLocaleDateString()}
                                                        </span>
                                                        {candidate.confidence !== null && (
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                {Math.round(candidate.confidence * 100)}% Confidence
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {!candidate.isAuthoritative && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="h-7 text-[10px] px-2 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                                                        disabled={isPromoting !== null}
                                                        onClick={() => handlePromote(candidate.id)}
                                                    >
                                                        {isPromoting === candidate.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save for reuse"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <p className="text-xs text-slate-400 italic">No alternative claims found.</p>
                            </div>
                        )}
                        <p className="mt-4 text-[10px] text-slate-400 leading-relaxed italic">
                            Promoting a suggestion will create a new verified manual entry using the source value, overriding the current authoritative choice.
                        </p>
                    </div>
                </div>
            </SheetContent>
            <NodeCreateDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                clientLEId={clientLEId}
                nodeType={createDialogType}
                initialData={initialNodeData}
                entityId={editingEntityId}
                onSuccess={handleCreateSuccess}
            />

            <GraphNodePickerDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                clientLEId={clientLEId}
                graphNodeType={graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS")}
                filterEdgeType={graphBindings.find(b => b.isActive)?.filterEdgeType}
                filterActiveOnly={graphBindings.find(b => b.isActive)?.filterActiveOnly ?? true}
                allowCreate={graphBindings.find(b => b.isActive)?.allowCreate ?? true}
                pickerLabel={graphBindings.find(b => b.isActive)?.pickerLabel || (isPartyRef ? "Select Party" : "Select Address")}
                pickerConfig={graphBindings.find(b => b.isActive)?.pickerConfig ?? null}
                isMultiValue={true}
                selectedNodeIds={currentSelectionIds}
                disabled={isAddingSaving || isLoadingBindings}
                onSelect={(item) => {
                    handleGraphNodeSelect(item);
                    setAddDialogOpen(false);
                }}
                onCreateNew={() => {
                    setAddDialogOpen(false);
                    handleCreateNewNode(graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS"));
                }}
            />
        </Sheet>
    );
}

/** Colour classes keyed by SourceType enum value (or legacy source type strings). */
const SOURCE_COLOR_MAP: Record<string, string> = {
    GLEIF:                  'bg-orange-100 text-orange-700 border-orange-200',
    REGISTRATION_AUTHORITY: 'bg-blue-100   text-blue-700  border-blue-200',
    USER_INPUT:             'bg-purple-100 text-purple-700 border-purple-200',
    SYSTEM:                 'bg-gray-100   text-gray-700  border-gray-200',
    SYSTEM_DERIVED:         'bg-gray-100   text-gray-700  border-gray-200',
    AI_EXTRACTION:          'bg-emerald-100 text-emerald-700 border-emerald-200',
    // Legacy source type strings that may appear on old FieldClaim rows
    COMPANIES_HOUSE:        'bg-blue-100   text-blue-700  border-blue-200',
    NATIONAL_REGISTRY:      'bg-blue-100   text-blue-700  border-blue-200',
};

/**
 * Pure presentation badge — delegates all label resolution to getSourceDisplayName.
 * Shows the entity-specific GLEIF RA code as a subtle secondary label for RA sources.
 * To change how any source is labelled, update source-display.ts only.
 */
function SourceBadge({ source, sourceReference, registrationAuthorityId }: { 
    source: string; 
    sourceReference?: string;
    /** Entity-specific GLEIF RA code, e.g. RA000585. Only shown for REGISTRATION_AUTHORITY sources. */
    registrationAuthorityId?: string;
}) {
    const classes = SOURCE_COLOR_MAP[source] || 'bg-gray-100 text-gray-700 border-gray-200';
    const label = getSourceDisplayName(source, sourceReference ?? null);
    const showRaCode = source === 'REGISTRATION_AUTHORITY' && registrationAuthorityId;

    return (
        <div className="flex items-center gap-1.5">
            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider", classes)}>
                {label}
                {showRaCode && (
                    <span className="ml-1 opacity-60 font-mono normal-case tracking-normal">
                        · {registrationAuthorityId}
                    </span>
                )}
            </span>
        </div>
    );
}
