"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StandardTooltip } from "@/components/ui/standard-tooltip";
import { getRegistryAuthorityNamesMap } from "@/actions/system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, History, Database, Edit, CheckCircle, CheckCircle2, AlertTriangle, Paperclip, FileText, Download, X, User as UserIcon, Pencil, Check, Trash2, Plus, Lock, Save, Link2Off, ArrowRightLeft, ChevronDown, ChevronRight, ArrowUpRight, HelpCircle, Building2 } from "lucide-react";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
import { getFieldUsageDetails, FieldUsageDetails } from "@/actions/client-le";
import { formatSystemDateTime } from "@/lib/date-utils";
import { useSession } from "next-auth/react";
import { checkCustomFieldDependencies, softDeleteCustomField, DependencyReport } from "@/actions/master-data-governance";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
// FIELD_DEFINITIONS removed
import { updateFieldManually, applyCandidate, updateCustomFieldManually, addMultiValueEntry, removeMultiValueEntry, clearSingleValueEntry, applyBulkOverride, promoteClaim, releaseFieldDefault, releaseFieldAbsence, restoreSourceValue } from "@/actions/kyc-manual-update";
import { promoteClaimToCCParty } from "@/actions/cc-party-actions";
import { saveAddressForReuse } from "@/actions/cc-address-actions";
import { setMasterFieldAssignment, setMasterFieldAssignmentStatus } from "@/actions/standing-data";
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
import { FieldSourceBadge } from "../fields/FieldSourceBadge";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { SaveForReuseTarget } from "@/lib/master-data/field-display-model";
import { FieldAttachments } from "@/components/client/fields/FieldAttachments";
import { AddressValueViewer } from "../fields/AddressValueViewer";
import { isAddressValue } from "@/lib/master-data/address-value";
import { AddressValueEditor } from "../fields/AddressValueEditor";
import { UnifiedAddressPicker } from "../fields/UnifiedAddressPicker";
import { isPersonOrContactValue, getPersonOrContactSummary, isValidPartyValue } from "@/lib/master-data/person-or-contact-value";
import { applyTransform } from "@/services/kyc/normalization/transforms";
import { PersonOrContactValueViewer } from "../fields/PersonOrContactValueViewer";
import { CanonicalPartyEditDialog } from "../fields/CanonicalPartyEditDialog";
import { UnifiedPartyPicker } from "../fields/UnifiedPartyPicker";
import { inferClaimValueKind, ClaimValueKind } from "@/lib/master-data/claim-value-resolver";
import { ExpandableRowItem } from "./expandable-row-item";
import { SharedResourceUsageNotice } from "./SharedResourceUsageNotice";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";
import { ExpandableText } from "@/components/ui/expandable-text";
import { getExpectedDataTypeLabel } from "@/lib/master-data/field-type-resolver";
import { CanonicalScalarEditor } from "@/components/client/fields/CanonicalScalarEditor";

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
    mappingStats?: { questions: number; questionnaires: number; suppliers: number };
}

export function FieldDetailPanel({ open, onOpenChange, clientLEId, fieldNo, fieldName, customFieldId, isLocked, onUpdate, registrationAuthorityId, mappingStats }: FieldDetailPanelProps) {
    const [data, setData] = useState<FieldDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const { data: session } = useSession();

    const [manualValue, setManualValue] = useState<any>("");
    const [manualReason, setManualReason] = useState("");
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [candidateToApply, setCandidateToApply] = useState<any | null>(null);
    const [partyEditDialogState, setPartyEditDialogState] = useState<{ open: boolean; rowId?: string; ccPartyId?: string; legacyPartyData?: any } | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAssignmentPopoverOpen, setIsAssignmentPopoverOpen] = useState(false);
    const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
    const [dependencyReport, setDependencyReport] = useState<DependencyReport | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const openDeleteDialog = async () => {
        if (!customFieldId) return;
        setIsDeleteDialogOpen(true);
        setIsCheckingDependencies(true);
        setDependencyReport(null);
        try {
            const report = await checkCustomFieldDependencies(customFieldId);
            setDependencyReport(report);
        } catch (e) {
            toast.error("Failed to check dependencies");
            setIsDeleteDialogOpen(false);
        } finally {
            setIsCheckingDependencies(false);
        }
    };

    const confirmDelete = async () => {
        if (!customFieldId) return;
        setIsDeleting(true);
        try {
            const res = await softDeleteCustomField(customFieldId);
            if (res.success) {
                toast.success("Field deleted");
                setIsDeleteDialogOpen(false);
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete field");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    const [isApplyingCandidate, setIsApplyingCandidate] = useState(false);
    const [relatedValues, setRelatedValues] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isClearingSingleValue, setIsClearingSingleValue] = useState(false);

    // Multi-value inline management state
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingRowValue, setEditingRowValue] = useState<any>("");
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    const [newEntryValue, setNewEntryValue] = useState<any>("");
    const [isAddingSaving, setIsAddingSaving] = useState(false);
    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [newPersonData, setNewPersonData] = useState<any>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const newEntryInputRef = useRef<HTMLInputElement>(null);

    // Canonical Registry Authority map
    const [raNameMap, setRaNameMap] = useState<Record<string, string>>({});

    useEffect(() => {
        let isMounted = true;
        getRegistryAuthorityNamesMap().then(map => {
            if (isMounted) setRaNameMap(map);
        });
        return () => { isMounted = false; };
    }, []);

    // Expandable usage details state
    const [usageDetails, setUsageDetails] = useState<FieldUsageDetails | null>(null);
    const [loadingUsageDetails, setLoadingUsageDetails] = useState(false);
    const [expandedSections, setExpandedSections] = useState<{ questions: boolean; questionnaires: boolean; suppliers: boolean }>({
        questions: false,
        questionnaires: false,
        suppliers: false,
    });

    useEffect(() => {
        if (open && clientLEId && (fieldNo || customFieldId) && mappingStats && mappingStats.questions > 0) {
            setLoadingUsageDetails(true);
            getFieldUsageDetails(clientLEId, fieldNo, customFieldId)
                .then((res) => {
                    setUsageDetails(res);
                })
                .catch((err) => {
                    console.error("Failed to load field usage details:", err);
                })
                .finally(() => {
                    setLoadingUsageDetails(false);
                });
        } else {
            setUsageDetails(null);
        }
    }, [open, clientLEId, fieldNo, customFieldId, mappingStats]);

    // Date & value formatting helpers
    const isDateType = data?.dataType === 'DATE' || data?.dataType === 'DATETIME';
    const isBooleanType = data?.dataType === 'BOOLEAN';
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

    const partyPopulationPolicy = data?.profileConfig?.partyPopulationPolicy || 
        (data?.hasActiveSourceMappings ? 'SYSTEM_ONLY' : 'SYSTEM_AND_CURATED');
    const isSystemOnlyParty = (isPartyField || isPartyRef) && partyPopulationPolicy === 'SYSTEM_ONLY';
    const isSystemOnlyAddress = (isAddressField || isAddressRef) && partyPopulationPolicy === 'SYSTEM_ONLY';

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

        if (parsedVal && typeof parsedVal === 'object' && parsedVal.explicitNone) {
            return <span className="text-slate-400 italic">None</span>;
        }

        if (isBooleanType) {
            if (val === true || val === "true") return <span className="text-slate-800 font-medium">Yes</span>;
            if (val === false || val === "false") return <span className="text-slate-800 font-medium">No</span>;
            return <span className="text-slate-800 font-medium">{String(val)}</span>;
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
                return (
                    <AddressValueViewer
                        value={parsedVal}
                        layout="compact"
                        claimId={rowData?.id || data?.current?.claimId}
                        isPromotedToCCC={rowData?.isPromotedToCCC || data?.current?.isPromotedToCCC}
                        isPromoting={isPromoting === (rowData?.id || data?.current?.claimId)}
                        onSaveForReuse={handleSaveForReuse}
                    />
                );
            }
            if (isPersonOrContactValue(parsedVal) || (parsedVal && typeof parsedVal === 'object' && 'ccPartyId' in parsedVal)) {
                const rowCanonical = (rowData as any)?.canonicalDisplayModel || (val as any)?.canonicalDisplayModel;
                const partyLabel = rowCanonical?.value?.partyLabel;
                const resolvedVal = (rowCanonical?.value?.kind === 'partyRef') 
                    ? rowCanonical.value.resolved 
                    : (rowCanonical?.value?.kind === 'party' ? rowCanonical.value.data : (parsedVal?.ccParty?.data || parsedVal?._resolvedData?.ccParty?.data || parsedVal));

                return (
                    <PersonOrContactValueViewer
                        value={resolvedVal || parsedVal}
                        partyLabel={partyLabel}
                        layout="compact"
                        displayMask={data?.profileConfig?.displayMask}
                        claimId={rowData?.id || data?.current?.claimId}
                        isPromotedToCCC={rowData?.isPromotedToCCC || data?.current?.isPromotedToCCC}
                        isPromoting={isPromoting === (rowData?.id || data?.current?.claimId)}
                        onSaveForReuse={handleSaveForReuse}
                    />
                );
            }
            if (parsedVal.firstName || parsedVal.lastName) return `${parsedVal.firstName || ''} ${parsedVal.lastName || ''}`.trim() + (parsedVal.metadata_type === 'LEGAL_ENTITY' ? ' (Company)' : '');
            if (parsedVal.name) return parsedVal.name;
            if (parsedVal.line1) return `${parsedVal.line1}${parsedVal.city ? ', ' + parsedVal.city : ''}`;
            // Code-list items: { code, label } — e.g. SIC codes
            if (parsedVal.code !== undefined) return parsedVal.label ? `${parsedVal.code} — ${parsedVal.label}` : String(parsedVal.code);
            
            // If it is an unresolved reference
            if (parsedVal.ccPartyId) return <span className="text-slate-400 italic">Unresolved Party</span>;

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

    // Team/Assignment State
    const [team, setTeam] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignmentNoteInput, setAssignmentNoteInput] = useState("");
    const [isSavingAssignmentNote, setIsSavingAssignmentNote] = useState(false);

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
    
    // UI State for Expandable List
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    
    // Node Creation/Editing State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createDialogType, setCreateDialogType] = useState<"PERSON" | "LEGAL_ENTITY" | "ADDRESS">("PERSON");
    const [initialNodeData, setInitialNodeData] = useState<any>(null);
    const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

    const fieldKey = String(fieldNo || customFieldId || "");

    const displayHistoryEvents = useMemo(() => {
        if (!data?.history || data.history.length === 0) return [];
        
        const rawHistory = data.history;
        const events: any[] = [];
        
        for (let i = 0; i < rawHistory.length; i++) {
            const current = rawHistory[i];
            
            
            let isExplicitNone = false;
            try {
                if (typeof current.newValue === 'object' && current.newValue !== null) {
                    isExplicitNone = current.newValue.explicitNone === true;
                } else if (typeof current.newValue === 'string') {
                    const parsed = JSON.parse(current.newValue);
                    isExplicitNone = parsed.explicitNone === true;
                }
            } catch (e) {}

            // 1. Tombstone
            if (current.isTombstone || isExplicitNone) {
                let previousValue = null;
                for (let j = i + 1; j < rawHistory.length; j++) {
                    let jIsExplicitNone = false;
                    try {
                        if (typeof rawHistory[j].newValue === 'object' && rawHistory[j].newValue !== null) {
                            jIsExplicitNone = rawHistory[j].newValue.explicitNone === true;
                        } else if (typeof rawHistory[j].newValue === 'string') {
                            const parsed = JSON.parse(rawHistory[j].newValue);
                            jIsExplicitNone = parsed.explicitNone === true;
                        }
                    } catch (e) {}
                    
                    if (rawHistory[j].instanceId === current.instanceId && !rawHistory[j].isTombstone && !jIsExplicitNone) {
                        previousValue = rawHistory[j].newValue;
                        break;
                    }
                }
                
                events.push({
                    ...current,
                    displayType: isExplicitNone ? 'EXPLICIT_NONE' : 'DELETE',
                    fromValue: previousValue,
                    toValue: null
                });
                continue;
            }
            
            // 2. New Value - Check for adjacent Tombstone to merge into EDIT
            let matchedEdit = false;
            if (i + 1 < rawHistory.length) {
                const nextOlder = rawHistory[i+1];
                // Group claims only when they can be matched with confidence.
                if (nextOlder.isTombstone && 
                    nextOlder.assertedByUserName === current.assertedByUserName && 
                    new Date(nextOlder.assertedAt).getTime() === new Date(current.assertedAt).getTime()) 
                {
                    // Find what the tombstone deleted
                    let previousValue = null;
                    for (let j = i + 2; j < rawHistory.length; j++) {
                        if (rawHistory[j].instanceId === nextOlder.instanceId && !rawHistory[j].isTombstone) {
                            previousValue = rawHistory[j].newValue;
                            break;
                        }
                    }
                    
                    events.push({
                        ...current,
                        displayType: 'EDIT_MERGED',
                        fromValue: previousValue,
                        toValue: current.newValue
                    });
                    
                    i++; // skip the tombstone
                    matchedEdit = true;
                }
            }
            
            if (!matchedEdit) {
                // Just an addition/update. Find the previous value if we can to show "From -> To"
                let previousValue = null;
                for (let j = i + 1; j < rawHistory.length; j++) {
                    if ((!data.isRepeating || rawHistory[j].instanceId === current.instanceId) && !rawHistory[j].isTombstone) {
                        previousValue = rawHistory[j].newValue;
                        break;
                    }
                }
                
                events.push({
                    ...current,
                    displayType: previousValue !== null ? 'UPDATE' : 'ADD',
                    fromValue: previousValue,
                    toValue: current.newValue
                });
            }
        }
        return events;
    }, [data?.history, data?.isRepeating]);

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

    const parsedAuthoritativeValue = useMemo(() => {
        if (!data?.current?.value) return null;
        if (typeof data.current.value === 'string' && (data.current.value.startsWith('{') || data.current.value.startsWith('['))) {
            try { return JSON.parse(data.current.value); } catch { return data.current.value; }
        }
        return data.current.value;
    }, [data?.current?.value]);

    useEffect(() => {
        if (open && (fieldNo || customFieldId)) {
            loadData();
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
            setAssignmentNoteInput(result?.assignment?.note || "");
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

    const handleSaveForReuse = async (target: SaveForReuseTarget) => {
        setIsPromoting(target.claimId);
        try {
            if (target.kind === 'EMBEDDED_PARTY') {
                const res = await promoteClaimToCCParty(target.claimId, clientLEId);
                if (res.success) {
                    toast.success("Saved for reuse");
                    loadData(); // Reload rows to update isPromotedToCCC flag
                } else {
                    toast.error((res as any).message || "Failed to save for reuse");
                }
            } else if (target.kind === 'ADDRESS') {
                const res = await saveAddressForReuse(target.claimId, clientLEId);
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
            setIsClearingSingleValue(false);
        }
    };

    const handleClearSingleValue = async () => {
        setIsSaving(true);
        try {
            const res = await clearSingleValueEntry(clientLEId, fieldNo);
            if (res.success) {
                toast.success("Value cleared");
                setIsClearingSingleValue(false);
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                if (onUpdate && refreshed?.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error(res.message || "Failed to clear value");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
            setIsClearingSingleValue(false);
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
        if (!manualValue && !customFieldId) {
            toast.error("A value is required");
            return;
        }

        // 1. Repeating Field Check
        if (data?.isRepeating && !selectedRowId) {
            toast.error("Please select a specific row to edit.");
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

    const confirmApplyCandidate = async () => {
        if (!candidateToApply) return;
        setIsApplyingCandidate(true);
        try {
            const result = await applyCandidate(clientLEId, candidateToApply, selectedRowId || undefined);
            if (result.success) {
                toast.success("Candidate applied");
                const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                setData(refreshed);
                setCandidateToApply(null);
                if (onUpdate && refreshed.current) {
                    onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                }
            } else {
                toast.error((result as any).message || "Apply failed");
            }
        } catch (error) {
            console.error("Apply error:", error);
            toast.error("An error occurred");
        } finally {
            setIsApplyingCandidate(false);
        }
    };

    const handleApplyCandidate = async (candidate: any) => {
        if (isLocked) {
            toast.error("Cannot apply candidate to a locked question.");
            return;
        }
        setCandidateToApply(candidate);
    };

    const handleAssign = async (userId: string | null, noteOverride?: string | null) => {
        if (customFieldId) {
            toast.error("Assignments on custom fields are not yet supported.");
            return;
        }

        setIsAssigning(true);
        try {
            const noteToSave = noteOverride !== undefined ? noteOverride : assignmentNoteInput;
            const res = await setMasterFieldAssignment(clientLEId, fieldNo, userId, noteToSave);
            if (res.success) {
                toast.success(userId ? "Field assigned successfully" : "Assignment removed");
                if (!userId) setAssignmentNoteInput("");
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

    const handleSaveAssignmentNote = async () => {
        if (!data?.assignment?.assignedToUserId) return;
        setIsSavingAssignmentNote(true);
        try {
            const res = await setMasterFieldAssignment(clientLEId, fieldNo, data.assignment.assignedToUserId, assignmentNoteInput);
            if (res.success) {
                toast.success("Assignment instruction updated");
                await loadData();
            } else {
                toast.error(res.error || "Failed to update assignment instruction");
            }
        } catch (e) {
            toast.error("Error saving instruction");
        } finally {
            setIsSavingAssignmentNote(false);
        }
    };

    const handleUpdateStatus = async (newStatus: "OPEN" | "DONE") => {
        if (!data?.assignment?.assignedToUserId) return;
        setIsAssigning(true);
        try {
            const res = await setMasterFieldAssignmentStatus(clientLEId, fieldNo, newStatus as any);
            if (res.success) {
                toast.success(newStatus === 'DONE' ? "Assignment marked as Done" : "Assignment reopened as Open");
                await loadData();
            } else {
                toast.error(res.error || "Failed to update work status");
            }
        } catch (e) {
            toast.error("Error updating work status");
        } finally {
            setIsAssigning(false);
        }
    };

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            
            <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                if (!isDeleting) setIsDeleteDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Custom Field</DialogTitle>
                        <DialogDescription className="sr-only">Confirm deletion of custom field</DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        {isCheckingDependencies ? (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                <p className="text-sm">Checking dependencies...</p>
                            </div>
                        ) : dependencyReport ? (
                            dependencyReport.canDelete ? (
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Are you sure you want to delete this custom field? <br/><br/>
                                    Deleting it will remove it from normal views and prevent it from being used in future questionnaires or mappings.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                                        <p className="font-semibold mb-2">This field cannot be deleted because it is currently in use.</p>
                                        <p>You must manually remove it from the following areas before deleting:</p>
                                    </div>
                                    <ul className="space-y-1 text-sm text-slate-700 pl-2">
                                        {dependencyReport.dependencies.referenceQuestionnaires > 0 && <li>• Used in <strong>{dependencyReport.dependencies.referenceQuestionnaires} Reference Questionnaire{dependencyReport.dependencies.referenceQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.workingQuestionnaires > 0 && <li>• Used in <strong>{dependencyReport.dependencies.workingQuestionnaires} Working Questionnaire{dependencyReport.dependencies.workingQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.engagementQuestionnaires > 0 && <li>• Mapped in <strong>{dependencyReport.dependencies.engagementQuestionnaires} Active Engagement{dependencyReport.dependencies.engagementQuestionnaires === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.clientProfilesWithData > 0 && <li>• Contains recorded data for <strong>{dependencyReport.dependencies.clientProfilesWithData} Client Profile{dependencyReport.dependencies.clientProfilesWithData === 1 ? '' : 's'}</strong></li>}
                                        {dependencyReport.dependencies.fiSchemaOverlays > 0 && <li>• Used in <strong>{dependencyReport.dependencies.fiSchemaOverlays} FI Schema Overlay{dependencyReport.dependencies.fiSchemaOverlays === 1 ? '' : 's'}</strong></li>}
                                    </ul>
                                </div>
                            )
                        ) : null}
                    </div>

                    <DialogFooter>
                        {!isCheckingDependencies && dependencyReport && (
                            dependencyReport.canDelete ? (
                                <>
                                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
                                    <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Delete Field
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => setIsDeleteDialogOpen(false)}>Close</Button>
                            )
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

<ConfirmDeleteDialog open={!!candidateToApply} onOpenChange={(open) => { if (!open) setCandidateToApply(null); }} title="Apply Candidate?" description={`Are you sure you want to apply this value: ${candidateToApply?.value}?`} onConfirm={confirmApplyCandidate} isLoading={isApplyingCandidate} confirmLabel="Apply" buttonVariant="default" />
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
                                {customFieldId && fieldNo === 0 && (
                                    <Button variant="ghost" size="icon" onClick={openDeleteDialog} className="text-slate-400 hover:text-red-600 hover:bg-red-50 ml-2" title="Delete Custom Field">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {fieldNo > 0 && (
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                    {data?.category || `Field #${fieldNo}`}
                                </span>
                            )}
                            {data && (
                                <div className="text-xs text-slate-500 font-normal">
                                    <span className="text-slate-400">Expected data:</span> <span className="text-slate-600 font-medium">{getExpectedDataTypeLabel(data)}</span>
                                </div>
                            )}
                            {data?.description && (
                                <ExpandableText
                                    text={data.description}
                                    className="mt-1.5 pr-2"
                                    textClassName="text-sm text-slate-600 leading-relaxed"
                                />
                            )}
                            {data?.assignment?.note && (
                                <div className="mt-2 text-xs text-indigo-900/90 font-medium italic flex items-start gap-1.5 max-w-full overflow-hidden">
                                    <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                    <span className="break-words line-clamp-3">
                                        <strong className="not-italic font-semibold text-indigo-950 mr-1">Instruction:</strong>
                                        "{data.assignment.note}"
                                    </span>
                                </div>
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
                                <Popover open={isAssignmentPopoverOpen} onOpenChange={setIsAssignmentPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            aria-label={data?.assignment?.assignedUser ? `Assignment control, assigned to ${data.assignment.assignedUser.name || data.assignment.assignedUser.email}, status ${data.assignment.status || 'OPEN'}` : "Assign master field"}
                                            className={cn(
                                                "h-8 shadow-xs gap-1.5 px-2.5 transition-all font-medium text-xs whitespace-nowrap",
                                                data?.assignment?.assignedUser
                                                    ? (data.assignment.status === 'DONE'
                                                        ? "bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100/80"
                                                        : "bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100/80")
                                                    : "text-slate-600 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            {data?.assignment?.assignedUser ? (
                                                <>
                                                    <Avatar className="h-4 w-4 border border-indigo-200 shrink-0">
                                                        <AvatarFallback className={cn("text-[8px] font-bold", data.assignment.status === 'DONE' ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800")}>
                                                            {(data.assignment.assignedUser.name || data.assignment.assignedUser.email || "U").substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate max-w-[90px] font-semibold text-slate-800">
                                                        {data.assignment.assignedUser.name?.split(" ")[0] || data.assignment.assignedUser.email}
                                                    </span>
                                                    <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5", data.assignment.status === 'DONE' ? "text-emerald-700 bg-emerald-100/80" : "text-slate-700 bg-slate-200/80")}>
                                                        {data.assignment.status === 'DONE' ? (
                                                            <>
                                                                <Check className="h-2.5 w-2.5" />
                                                                Done
                                                            </>
                                                        ) : (
                                                            "Open"
                                                        )}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-slate-600 font-medium">Assign</span>
                                                </>
                                            )}
                                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-0.5" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent align="end" className="w-[300px] p-3.5 space-y-3.5 shadow-lg border-slate-200 z-50">
                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">
                                            <span>Assignment & Work</span>
                                            {data?.assignment && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={async () => {
                                                        await handleAssign(null);
                                                        setIsAssignmentPopoverOpen(false);
                                                    }}
                                                    className="h-6 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5 font-normal"
                                                >
                                                    Unassign
                                                </Button>
                                            )}
                                        </div>

                                        {/* Assigned To */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</label>
                                            <Select
                                                value={data?.assignment?.assignedToUserId || "UNASSIGNED"}
                                                onValueChange={async (val) => {
                                                    await handleAssign(val === "UNASSIGNED" ? null : val);
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                                                    <SelectValue placeholder="Select assignee..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="UNASSIGNED" className="text-xs">
                                                        <span className="text-slate-500 italic">Unassigned</span>
                                                    </SelectItem>
                                                    {team.map((user: any) => (
                                                        <SelectItem key={user.id} value={user.id} className="text-xs">
                                                            <span className="font-medium text-slate-800">{user.name || user.email}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Work Status (if assigned) */}
                                        {data?.assignment && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Work Status</label>
                                                <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
                                                    <Button
                                                        variant={data.assignment.status === 'OPEN' ? 'default' : 'ghost'}
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus('OPEN')}
                                                        className={cn(
                                                            "h-7 text-xs flex-1 font-medium transition-all",
                                                            data.assignment.status === 'OPEN' ? "bg-slate-800 hover:bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-white"
                                                        )}
                                                    >
                                                        Open
                                                    </Button>
                                                    <Button
                                                        variant={data.assignment.status === 'DONE' ? 'default' : 'ghost'}
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus('DONE')}
                                                        className={cn(
                                                            "h-7 text-xs flex-1 font-medium transition-all",
                                                            data.assignment.status === 'DONE' ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-white"
                                                        )}
                                                    >
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Done
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Instruction Note */}
                                        {data?.assignment && (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instruction</label>
                                                <Textarea
                                                    placeholder="Add instruction for assignee (optional)..."
                                                    value={assignmentNoteInput}
                                                    onChange={(e) => setAssignmentNoteInput(e.target.value)}
                                                    rows={2}
                                                    className="text-xs bg-slate-50 border-slate-200 resize-none focus-visible:ring-indigo-500"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={async () => {
                                                        await handleSaveAssignmentNote();
                                                        setIsAssignmentPopoverOpen(false);
                                                    }}
                                                    disabled={isSavingAssignmentNote}
                                                    className="w-full h-7 text-xs bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                                                >
                                                    {isSavingAssignmentNote ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Instruction"}
                                                </Button>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
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

                <div className="flex-1 overflow-y-auto pr-6 -mr-6 pt-3">
                    {/* ─── Current Authoritative Value ─── */}
                    <div className="space-y-3 shrink-0">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Current Authoritative Value
                        </div>
                        <div>
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
                                                        <FieldSourceBadge 
                                                            legacySourceType="USER_INPUT" 
                                                            variant="span"
                                                            className="uppercase tracking-wider"
                                                            wrapperClassName="flex items-center gap-1.5"
                                                        />
                                                    ) : data.rows[0]?.source ? (
                                                        <FieldSourceBadge 
                                                            legacySourceType={data.rows[0].source as any} 
                                                            legacySourceReference={data.rows[0].sourceReference} 
                                                            legacyRaId={registrationAuthorityId} 
                                                            legacyRaName={(registrationAuthorityId ? raNameMap[registrationAuthorityId] : undefined) || 'Registration Authority'}
                                                            variant="span"
                                                            className="uppercase tracking-wider"
                                                            wrapperClassName="flex items-center gap-1.5"
                                                        />
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
                                                        const isPartyRefValue = inferredKind === 'PARTY_REF';
                                                        
                                                        const canEdit = row.source === 'USER_INPUT';
                                                        const canRemove = row.source === 'USER_INPUT';
                                                        
                                                        const actionButtons = !isLocked && (
                                                            <div className="flex items-center gap-0.5 shrink-0">
                                                                {canEdit && (
                                                                    <button
                                                                        className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                                        onClick={() => {
                                                                            if (isObjectRef) {
                                                                                handleEditNode(row);
                                                                            } else if (inferredKind === 'PARTY_REF' || inferredKind === 'EMBEDDED_PARTY' || isPersonOrContactField || isCuratedPartyRef) {
                                                                                const partyData = row.data?.ccParty?.data || row.data?._resolvedData?.ccParty?.data || parsedRowValue;
                                                                                const ccPartyId = inferredKind === 'PARTY_REF' ? parsedRowValue?.ccPartyId : undefined;
                                                                                setPartyEditDialogState({
                                                                                    open: true,
                                                                                    rowId: row.id,
                                                                                    ccPartyId,
                                                                                    legacyPartyData: partyData
                                                                                });
                                                                            } else {
                                                                                setEditingRowId(row.id);
                                                                                if (inferredKind === 'ADDRESS_REF') {
                                                                                    setEditingRowValue(row.data?.ccAddress?.data || row.data?._resolvedData?.ccAddress?.data || parsedRowValue);
                                                                                } else {
                                                                                    setEditingRowValue(parsedRowValue);
                                                                                }
                                                                            }
                                                                        }}
                                                                        title="Edit value"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                                {canRemove && (
                                                                    <button
                                                                        className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                                        onClick={() => setDeletingRowId(row.id)}
                                                                        title={isPartyRefValue ? "Break link to party reference" : "Remove value"}
                                                                    >
                                                                        {isPartyRefValue ? <Link2Off className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );

                                                        const rowCanonicalModel = (row as any)?.canonicalDisplayModel;
                                                        const rowPartyLabel = rowCanonicalModel?.value?.partyLabel;
                                                        const resolvedRowPartyVal = (rowCanonicalModel?.value?.kind === 'partyRef')
                                                            ? rowCanonicalModel.value.resolved
                                                            : (rowCanonicalModel?.value?.kind === 'party' ? rowCanonicalModel.value.data : null);

                                                        const partyValForExpandable = resolvedRowPartyVal || ((parsedRowValue && typeof parsedRowValue === 'object' && (isPersonOrContactValue(parsedRowValue) || 'ccPartyId' in parsedRowValue)) 
                                                            ? (parsedRowValue.ccParty?.data || parsedRowValue._resolvedData?.ccParty?.data || row?.data?.ccParty?.data || parsedRowValue)
                                                            : null);

                                                        const addressValForExpandable = (parsedRowValue && typeof parsedRowValue === 'object' && (isAddressValue(parsedRowValue) || 'ccAddressId' in parsedRowValue))
                                                            ? (parsedRowValue.ccAddress?.data || parsedRowValue._resolvedData?.ccAddress?.data || row?.data?.ccAddress?.data || parsedRowValue)
                                                            : null;

                                                        return (
                                                        <div key={row.id}>
                                                            {deletingRowId === row.id ? (
                                                                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 animate-in fade-in duration-150">
                                                                    <span className="text-xs text-red-700 font-medium truncate flex-1 flex items-center gap-1">
                                                                        {isPartyRefValue ? (
                                                                            <span>Break link to "{row.data?.resolvedSummary || (typeof row.value === 'object' && row.value?.ccPartyId) || 'saved party'}"?</span>
                                                                        ) : (
                                                                            <>
                                                                                Remove "{typeof row.value === 'object' && row.value ? (row.value.label || JSON.stringify(row.value)) : String(row.value)}"?
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
                                                                <div className={cn(
                                                                    "px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 animate-in fade-in duration-150 flex items-center gap-1.5"
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
                                                                    ) : inferredKind === 'ADDRESS_REF' || inferredKind === 'ADDRESS' ? (
                                                                        <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                                                                            {parsedRowValue?.ccAddressId && (
                                                                                <SharedResourceUsageNotice
                                                                                    resourceType="ADDRESS"
                                                                                    resourceId={parsedRowValue.ccAddressId}
                                                                                    clientLEId={clientLEId}
                                                                                    currentFieldNo={fieldNo}
                                                                                />
                                                                            )}
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
                                                                    ) : data?.options && data.options.length > 0 ? (
                                                                        <Select
                                                                            value={editingRowValue}
                                                                            onValueChange={setEditingRowValue}
                                                                            disabled={isSaving}
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm flex-1 bg-white border-indigo-200 focus:border-indigo-400">
                                                                                <SelectValue placeholder="Select a value..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent position="item-aligned">
                                                                                {data.options.map((opt: any) => {
                                                                                    const v = typeof opt === 'object' ? opt.value : opt;
                                                                                    const l = typeof opt === 'object' ? opt.label : opt;
                                                                                    return <SelectItem key={v} value={v}>{l}</SelectItem>;
                                                                                })}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : isBooleanType ? (
                                                                        <Select
                                                                            value={String(editingRowValue)}
                                                                            onValueChange={(val) => setEditingRowValue(val === 'true')}
                                                                            disabled={isSaving}
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm flex-1 bg-white border-indigo-200 focus:border-indigo-400">
                                                                                <SelectValue placeholder="Select Yes/No..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="true">Yes</SelectItem>
                                                                                <SelectItem value="false">No</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : (
                                                                        <Input
                                                                            type={isDateType ? 'date' : 'text'}
                                                                            value={isDateType ? formatDateForInput(editingRowValue) : editingRowValue}
                                                                            onChange={(e) => setEditingRowValue(isDateType ? parseDateFromInput(e.target.value) : e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && (typeof editingRowValue === 'string' ? editingRowValue.trim() : true)) handleInlineEditSave(row);
                                                                                if (e.key === 'Escape') { setEditingRowId(null); setEditingRowValue(""); }
                                                                            }}
                                                                            className="h-8 text-sm flex-1 bg-white border-indigo-200 focus:border-indigo-400"
                                                                            autoFocus
                                                                            disabled={isSaving}
                                                                        />
                                                                    )}

                                                                    {!isObjectRef && inferredKind !== 'ADDRESS_REF' && inferredKind !== 'ADDRESS' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-green-600 hover:bg-green-50 shrink-0"
                                                                            onClick={() => handleInlineEditSave(row)}
                                                                            disabled={isSaving || (typeof editingRowValue === 'string' ? !editingRowValue.trim() : false)}
                                                                            title="Save value"
                                                                        >
                                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                    )}
                                                                    {inferredKind !== 'ADDRESS_REF' && inferredKind !== 'ADDRESS' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-slate-400 hover:bg-slate-100 shrink-0"
                                                                            onClick={() => { setEditingRowId(null); setEditingRowValue(""); }}
                                                                            title="Cancel"
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all">
                                                                    <div className="flex-1 min-w-0">
                                                                        {partyValForExpandable ? (
                                                                            <ExpandableRowItem
                                                                                isExpanded={expandedRowId === row.id}
                                                                                onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                                                                                collapsedContent={
                                                                                    <PersonOrContactValueViewer
                                                                                        value={partyValForExpandable}
                                                                                        partyLabel={rowPartyLabel}
                                                                                        layout="row"
                                                                                        displayMask={data?.profileConfig?.displayMask}
                                                                                        claimId={row.id}
                                                                                        isPromotedToCCC={row.isPromotedToCCC}
                                                                                        isPromoting={isPromoting === row.id}
                                                                                        onSaveForReuse={handleSaveForReuse}
                                                                                    />
                                                                                }
                                                                                expandedContent={
                                                                                    <PersonOrContactValueViewer
                                                                                        value={partyValForExpandable}
                                                                                        partyLabel={rowPartyLabel}
                                                                                        layout="detailed"
                                                                                        displayMask={data?.profileConfig?.displayMask}
                                                                                        claimId={row.id}
                                                                                        isPromotedToCCC={row.isPromotedToCCC}
                                                                                        isPromoting={isPromoting === row.id}
                                                                                        onSaveForReuse={handleSaveForReuse}
                                                                                    />
                                                                                }
                                                                            />
                                                                        ) : addressValForExpandable ? (
                                                                            <ExpandableRowItem
                                                                                isExpanded={expandedRowId === row.id}
                                                                                onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                                                                                collapsedContent={
                                                                                    <AddressValueViewer
                                                                                        value={addressValForExpandable}
                                                                                        layout="compact"
                                                                                        claimId={row.id}
                                                                                        isPromotedToCCC={row.isPromotedToCCC}
                                                                                        isPromoting={isPromoting === row.id}
                                                                                        onSaveForReuse={handleSaveForReuse}
                                                                                    />
                                                                                }
                                                                                expandedContent={
                                                                                    <AddressValueViewer
                                                                                        value={addressValForExpandable}
                                                                                        layout="detailed"
                                                                                        claimId={row.id}
                                                                                        isPromotedToCCC={row.isPromotedToCCC}
                                                                                        isPromoting={isPromoting === row.id}
                                                                                        onSaveForReuse={handleSaveForReuse}
                                                                                    />
                                                                                }
                                                                            />
                                                                        ) : (
                                                                            <div className="text-sm font-medium text-slate-800 break-words whitespace-normal leading-snug">
                                                                                {typeof row.value === 'string' && row.value.length > 400 && !row.value.startsWith('{') && !row.value.startsWith('[') ? (
                                                                                    <ExpandableText 
                                                                                        text={row.value} 
                                                                                        targetChars={300} 
                                                                                        overflowThreshold={400} 
                                                                                        textClassName="text-sm font-medium text-slate-800 leading-snug" 
                                                                                    />
                                                                                ) : (
                                                                                    renderRowValue(row.value, row)
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <FieldSourceBadge 
                                                                                legacySourceType={row.source || 'UNKNOWN'} 
                                                                                legacySourceReference={row.sourceReference} 
                                                                                legacyRaId={registrationAuthorityId} 
                                                                                legacyRaName={(registrationAuthorityId ? raNameMap[registrationAuthorityId] : undefined) || 'Registration Authority'}
                                                                                variant="span"
                                                                                className="uppercase tracking-wider"
                                                                                wrapperClassName="flex items-center gap-1.5"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {actionButtons}
                                                                </div>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}

                                            {/* Add item control for repeating fields */}
                                            {!isLocked && (
                                                <div className="pt-2">
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
                                                            onSelect={(item) => handleGraphNodeSelect(item)}
                                                            onCreateNew={() => handleCreateNewNode(graphBindings.find(b => b.isActive)?.graphNodeType || (isPartyRef ? "PERSON" : "ADDRESS"))}
                                                        />
                                                    ) : isCuratedPartyRef || isPersonOrContactField ? (
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
                                                            trigger={
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700 border-dashed text-xs shadow-xs"
                                                                >
                                                                    <Plus className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                                                    {isCuratedPartyRef ? "Select saved party" : (fieldNo === 63 ? 'Add Director' : 'Select Party / Contact')}
                                                                </Button>
                                                            }
                                                        />
                                                    ) : isAddressField ? (
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
                                                                        {isBooleanType ? (
                                                                            <Select
                                                                                value={String(newEntryValue)}
                                                                                onValueChange={(val) => setNewEntryValue(val === 'true')}
                                                                                disabled={isAddingSaving}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-sm pl-8 flex-1 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-indigo-300">
                                                                                    <SelectValue placeholder="Select Yes/No..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="true">Yes</SelectItem>
                                                                                    <SelectItem value="false">No</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <Input
                                                                                ref={newEntryInputRef}
                                                                                type={isDateType ? 'date' : 'text'}
                                                                                value={isDateType ? formatDateForInput(newEntryValue) : newEntryValue}
                                                                                onChange={(e) => setNewEntryValue(isDateType ? parseDateFromInput(e.target.value) : e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter' && (typeof newEntryValue === 'string' ? newEntryValue.trim() : true)) handleAddNewEntry();
                                                                                }}
                                                                                placeholder={isDateType ? '' : 'Add new value...'}
                                                                                className="h-8 text-sm pl-8 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-indigo-300"
                                                                                disabled={isAddingSaving}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 px-3 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
                                                                        onClick={() => handleAddNewEntry()}
                                                                        disabled={isAddingSaving || newEntryValue === "" || (typeof newEntryValue === 'string' && !newEntryValue.trim())}
                                                                    >
                                                                        {isAddingSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            </>
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
                                                                    {data?.canonicalDisplayModel && !data.isRepeating ? (
                                                                        <div>
                                                                            <FieldValueRenderer
                                                                                field={data.canonicalDisplayModel!}
                                                                                claimId={data.current?.claimId}
                                                                                isPromotedToCCC={data.current?.isPromotedToCCC}
                                                                                isPromoting={isPromoting === data.current?.claimId}
                                                                                onSaveForReuse={handleSaveForReuse}
                                                                            />
                                                                        </div>
                                                                    ) : isAddressValue(data.current.value) || (data.current.value && typeof data.current.value === 'object' && 'ccAddressId' in data.current.value) ? (
                                                                         <AddressValueViewer
                                                                             value={data.current.value?._resolvedData?.ccAddress?.data || data.current.value}
                                                                             layout="detailed"
                                                                             claimId={data.current?.claimId}
                                                                             isPromotedToCCC={data.current?.isPromotedToCCC}
                                                                             isPromoting={isPromoting === data.current?.claimId}
                                                                             onSaveForReuse={handleSaveForReuse}
                                                                         />
                                                                     ) : (isPersonOrContactValue(data.current.value) || (data.current.value && typeof data.current.value === 'object' && 'ccPartyId' in data.current.value)) ? (
                                                                            <PersonOrContactValueViewer
                                                                                value={(data?.canonicalDisplayModel?.value?.kind === 'partyRef' ? data.canonicalDisplayModel.value.resolved : (data?.canonicalDisplayModel?.value?.kind === 'party' ? data.canonicalDisplayModel.value.data : null)) || data.current.value?.ccParty?.data || data.current.value?._resolvedData?.ccParty?.data || data.current.value}
                                                                                partyLabel={(data?.canonicalDisplayModel?.value as any)?.partyLabel}
                                                                                layout="detailed"
                                                                                displayMask={data?.profileConfig?.displayMask}
                                                                                claimId={data.current?.claimId}
                                                                                isPromotedToCCC={data.current?.isPromotedToCCC}
                                                                                isPromoting={isPromoting === data.current?.claimId}
                                                                                onSaveForReuse={handleSaveForReuse}
                                                                            />
                                                                        ) : Array.isArray(data.current.value) ? (
                                                                        <div className="flex flex-col gap-2 mt-1">
                                                                            {data.current.value.map((v: any, idx: number) => {
                                                                                let parsed = v;
                                                                                if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) { try { parsed = JSON.parse(v); } catch {} }
                                                                                if (isPersonOrContactValue(parsed) || (parsed && typeof parsed === 'object' && 'ccPartyId' in parsed)) {
                                                                                    const itemCanonical = data?.canonicalDisplayModel?.value?.kind === 'collection' ? data.canonicalDisplayModel.value.items[idx] : null;
                                                                                    const partyLabel = itemCanonical?.value ? (itemCanonical.value as any).partyLabel : undefined;
                                                                                    const resolvedVal = itemCanonical?.value?.kind === 'partyRef' 
                                                                                        ? itemCanonical.value.resolved 
                                                                                        : (itemCanonical?.value?.kind === 'party' ? itemCanonical.value.data : (parsed?.ccParty?.data || parsed?._resolvedData?.ccParty?.data || parsed));

                                                                                    const partyVal = resolvedVal || parsed?.ccParty?.data || parsed?._resolvedData?.ccParty?.data || parsed;
                                                                                    const rowId = `current_auth_${idx}`;
                                                                                    return (
                                                                                        <ExpandableRowItem
                                                                                            key={rowId}
                                                                                            isExpanded={expandedRowId === rowId}
                                                                                            onToggle={() => setExpandedRowId(expandedRowId === rowId ? null : rowId)}
                                                                                            collapsedContent={
                                                                                                <PersonOrContactValueViewer
                                                                                                    value={partyVal}
                                                                                                    partyLabel={partyLabel}
                                                                                                    layout="row"
                                                                                                    displayMask={data?.profileConfig?.displayMask}
                                                                                                    claimId={data.current?.claimId}
                                                                                                    isPromotedToCCC={data.current?.isPromotedToCCC}
                                                                                                    isPromoting={isPromoting === data.current?.claimId}
                                                                                                    onSaveForReuse={handleSaveForReuse}
                                                                                                />
                                                                                            }
                                                                                            expandedContent={
                                                                                                <PersonOrContactValueViewer
                                                                                                    value={partyVal}
                                                                                                    partyLabel={partyLabel}
                                                                                                    layout="detailed"
                                                                                                    displayMask={data?.profileConfig?.displayMask}
                                                                                                    claimId={data.current?.claimId}
                                                                                                    isPromotedToCCC={data.current?.isPromotedToCCC}
                                                                                                    isPromoting={isPromoting === data.current?.claimId}
                                                                                                    onSaveForReuse={handleSaveForReuse}
                                                                                                />
                                                                                            }
                                                                                        />
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <Badge key={idx} variant="outline" className="bg-white border-slate-300 text-slate-800 py-1 px-2.5 text-sm shadow-sm ring-1 ring-slate-100/50 inline-flex w-fit">
                                                                                        {renderRowValue(v)}
                                                                                    </Badge>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        renderRowValue(data.current.value)
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 flex items-center gap-2">
                                                                    <FieldSourceBadge 
                                                                        source={data.canonicalDisplayModel?.source}
                                                                        legacySourceType={data.current.source || 'UNKNOWN'} 
                                                                        legacySourceReference={data.current.sourceReference} 
                                                                        legacyRaId={registrationAuthorityId} 
                                                                        legacyRaName={(registrationAuthorityId ? raNameMap[registrationAuthorityId] : undefined) || 'Registration Authority'}
                                                                        variant="span"
                                                                        className="uppercase tracking-wider"
                                                                        wrapperClassName="flex items-center gap-1.5"
                                                                        showLastValidated={true}
                                                                    />
                                                                </div>
                                                            </div>
                                                             {!isLocked && (
                                                                 isPersonOrContactField || isCuratedPartyRef ? (
                                                                     <div className="flex items-center gap-1.5 shrink-0">
                                                                         <button
                                                                             className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                             onClick={() => {
                                                                                 const partyData = data?.current?.value?._resolvedData?.ccParty?.data || data?.current?.value || parsedAuthoritativeValue;
                                                                                 const ccPartyId = isCuratedPartyRef ? (data?.current?.value?.ccPartyId || parsedAuthoritativeValue?.ccPartyId) : undefined;
                                                                                 setPartyEditDialogState({
                                                                                     open: true,
                                                                                     ccPartyId,
                                                                                     legacyPartyData: partyData
                                                                                 });
                                                                             }}
                                                                             title={isCuratedPartyRef ? "Edit saved party" : "Edit party details"}
                                                                         >
                                                                             <Pencil className="h-3.5 w-3.5" />
                                                                         </button>
                                                                         {data?.current?.source === 'USER_INPUT' && (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                                                                                 onClick={() => setIsClearingSingleValue(true)}
                                                                                 title={isCuratedPartyRef ? "Break link to party reference" : "Clear value"}
                                                                             >
                                                                                 {isCuratedPartyRef ? <Link2Off className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
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
                                                                 ) : (
                                                                     <div className="flex items-center gap-1.5 shrink-0">
                                                                         <button
                                                                             className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                             onClick={() => {
                                                                                 if (data?.current) {
                                                                                     setManualValue(data.current.value);
                                                                                 }
                                                                                 setIsEditing(true);
                                                                                 setRelatedValues({});
                                                                             }}
                                                                             title="Edit value"
                                                                         >
                                                                             <Pencil className="h-3.5 w-3.5" />
                                                                         </button>
                                                                         {data?.current?.source === 'USER_INPUT' && (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                                                                                 onClick={() => setIsClearingSingleValue(true)}
                                                                                 title="Clear value"
                                                                             >
                                                                                 <Trash2 className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         )}
                                                                     </div>
                                                                 )
                                                             )}
                                                        </div>

                                                        {/* Clear value confirmation overlay */}
                                                        {isClearingSingleValue && (
                                                            <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 animate-in fade-in duration-150">
                                                                <span className="text-xs text-red-700 font-medium truncate flex-1 flex items-center gap-1">
                                                                    {isCuratedPartyRef ? 'Break link to party reference?' : 'Clear this value?'}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-2 text-[11px] text-red-700 hover:bg-red-100 hover:text-red-800"
                                                                        onClick={() => handleClearSingleValue()}
                                                                        disabled={isSaving}
                                                                    >
                                                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : isCuratedPartyRef ? 'Yes, break link' : 'Yes, clear'}
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
                                                /* Empty state */
                                                <div className="flex items-start gap-3 mt-2">
                                                    <div className="flex-1 space-y-2">
                                                         {!isEditing ? (
                                                             (data?.displayState === 'DEFAULT_RESPONSE' && data?.defaultResponse) ? (
                                                                 <div className="relative">
                                                                     <div className="flex items-start justify-between">
                                                                         <div className="mt-0.5">
                                                                             <div className="py-3 px-1">
                                                                                 <div className="flex items-center gap-2 not-italic text-blue-600 font-medium">
                                                                                     <span>{data.defaultResponse}</span>
                                                                                     <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-blue-500 bg-blue-50 border-blue-200">Field Default</Badge>
                                                                                 </div>
                                                                             </div>
                                                                         </div>
                                                                         {!isLocked && (
                                                                             <button
                                                                                 className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                                                                                 onClick={() => setIsEditing(true)}
                                                                                 title="Add value"
                                                                             >
                                                                                 <Pencil className="h-3.5 w-3.5" />
                                                                             </button>
                                                                         )}
                                                                     </div>
                                                                 </div>
                                                             ) : (
                                                                <div className="relative">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="mt-0.5">
                                                                        <div className="text-sm text-slate-500 italic mb-2">
                                                                            {data?.displayState === 'CHECKED_NO_DATA' && (
                                                                                <div className="not-italic text-slate-800 font-medium">None</div>
                                                                            )}
                                                                            {data?.displayState === 'DEFAULT_RESPONSE' && (
                                                                                <span className="flex items-center gap-2 not-italic text-blue-600 font-medium">
                                                                                    <span>{data.defaultResponse}</span>
                                                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-blue-500 bg-blue-50 border-blue-200">Field Default</Badge>
                                                                                </span>
                                                                            )}
                                                                            {(!data?.displayState || data?.displayState === 'UNMAPPED_NO_RESPONSE' || data?.displayState === 'MAPPED_NOT_CHECKED') && 'No response recorded'}
                                                                        </div>
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
                                                                <CanonicalScalarEditor
                                                                    dataType={data?.dataType}
                                                                    value={manualValue}
                                                                    onChange={setManualValue}
                                                                    options={data?.options}
                                                                    disabled={isSaving}
                                                                    fieldName={fieldName}
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && (manualValue === true || manualValue === false || (typeof manualValue === 'string' ? manualValue.trim() : manualValue))) {
                                                                            setIsEditing(true);
                                                                            handleManualSave();
                                                                        }
                                                                    }}
                                                                />
                                                                {(manualValue === true || manualValue === false || (manualValue && typeof manualValue === 'string' ? manualValue.trim() : manualValue)) && (
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

                            {/* Explicit Edit Mode */}
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

                                        {isCuratedPartyRef || isPersonOrContactField ? (
                                            <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                                {parsedAuthoritativeValue?.ccPartyId && (
                                                    <SharedResourceUsageNotice
                                                        resourceType="PARTY"
                                                        resourceId={parsedAuthoritativeValue.ccPartyId}
                                                        clientLEId={clientLEId}
                                                        currentFieldNo={fieldNo}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs text-slate-600 font-medium">
                                                        Use the canonical editor to update this party's details.
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs shrink-0"
                                                        onClick={() => {
                                                            setPartyEditDialogState({
                                                                open: true,
                                                                rowId: selectedRowId || undefined,
                                                                ccPartyId: parsedAuthoritativeValue?.ccPartyId,
                                                                legacyPartyData: parsedAuthoritativeValue
                                                            });
                                                        }}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                        Edit Party Details
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : isAddressField || isCuratedAddressRef ? (
                                            <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                                {parsedAuthoritativeValue?.ccAddressId && (
                                                    <SharedResourceUsageNotice
                                                        resourceType="ADDRESS"
                                                        resourceId={parsedAuthoritativeValue.ccAddressId}
                                                        clientLEId={clientLEId}
                                                        currentFieldNo={fieldNo}
                                                    />
                                                )}
                                                <AddressValueEditor
                                                    value={typeof manualValue === 'object' && manualValue ? manualValue : { addressLines: [] } as any}
                                                    onChange={(val) => setManualValue(val as any)}
                                                    disabled={isSaving}
                                                />
                                            </div>
                                        ) : (
                                            <CanonicalScalarEditor
                                                dataType={data?.dataType}
                                                value={manualValue}
                                                onChange={setManualValue}
                                                options={data?.options}
                                                disabled={isSaving}
                                                fieldName={fieldName}
                                            />
                                        )}
                                    </div>

                                    {/* Related Fields */}
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

                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-tight">Audit Notes (Optional)</label>
                                        <Textarea
                                            value={manualReason}
                                            onChange={(e) => setManualReason(e.target.value)}
                                            placeholder="Add notes about this edit (optional)..."
                                            className="h-24 bg-white border-slate-300 focus:ring-indigo-500 shadow-sm"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                         <Button
                                             size="sm"
                                             onClick={handleManualSave}
                                             disabled={isSaving}
                                         >
                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle className="h-3 w-3 mr-2" />}
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Field Attachments ─── */}
                    {data?.canonicalDisplayModel?.allowAttachments && (
                        <div className="pt-6 border-t border-slate-200/80 space-y-3">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Field Attachments
                            </div>
                            <FieldAttachments 
                                clientLEId={clientLEId} 
                                fieldNo={data.fieldNo || fieldNo} 
                                attachments={data.canonicalDisplayModel.attachments || []} 
                                isEditable={!isLocked}
                                mode="manage" 
                                onChange={loadData}
                            />
                        </div>
                    )}

                    {/* ─── Usage Section (Hierarchical Relationship Tree) ─── */}
                    {!customFieldId && (
                        <div className="pt-6 border-t border-slate-200/80 space-y-3">
                            {/* Section Header */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Relationships & Usage
                                </span>
                                {mappingStats && mappingStats.questions > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 font-medium">
                                            {mappingStats.suppliers} Relationship{mappingStats.suppliers !== 1 ? 's' : ''}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 font-medium">
                                            {mappingStats.questions} Question{mappingStats.questions !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            {/* Line-Level Tree Content */}
                            <div className="text-xs">
                                {mappingStats && mappingStats.questions > 0 ? (
                                    loadingUsageDetails ? (
                                        <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            <span>Loading usage hierarchy...</span>
                                        </div>
                                    ) : usageDetails?.relationships && usageDetails.relationships.length > 0 ? (
                                        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                                            {usageDetails.relationships.map((rel) => (
                                                <div key={rel.supplierId} className="space-y-2">
                                                    {/* Level 1: Relationship */}
                                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-md p-2 px-3 group">
                                                        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                        <Link
                                                            href={`/app/le/${clientLEId}/workbench4?rel=${encodeURIComponent(rel.supplierId === 'common' || rel.supplierName === 'Common Questionnaires' ? 'Common' : rel.supplierName)}`}
                                                            target="_blank"
                                                            className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition-colors flex items-center gap-1.5"
                                                            title={`View all questions from ${rel.supplierName} in Question Bank`}
                                                        >
                                                            <span>{rel.supplierName}</span>
                                                            <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </Link>
                                                        {rel.supplierCode && (
                                                            <Badge variant="outline" className="text-[9px] bg-white text-slate-500 font-mono py-0 px-1 ml-auto shrink-0">
                                                                {rel.supplierCode}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {/* Level 2 & 3: Questionnaires & Questions */}
                                                    <div className="pl-4 space-y-3 border-l-2 border-slate-100 ml-3">
                                                        {rel.questionnaires.map((qGroup) => (
                                                            <div key={qGroup.questionnaireId} className="space-y-1.5">
                                                                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                                                                    <Link
                                                                        href={`/app/le/${clientLEId}/workbench4?q=${encodeURIComponent(qGroup.questionnaireName)}`}
                                                                        target="_blank"
                                                                        className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                                                                    >
                                                                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                                                        <span>{qGroup.questionnaireName}</span>
                                                                    </Link>
                                                                    <span className="text-[10px] text-slate-400">{qGroup.questions.length} Qs</span>
                                                                </div>

                                                                {/* Level 3: Individual Mapped Questions */}
                                                                <div className="pl-3 space-y-1">
                                                                    {qGroup.questions.map((q) => (
                                                                        <div key={q.id} className="flex items-start justify-between gap-2 text-[11px] text-slate-600 group">
                                                                            <Link
                                                                                href={`/app/le/${clientLEId}/workbench4?s=${encodeURIComponent(q.text)}`}
                                                                                target="_blank"
                                                                                className="flex items-start gap-1.5 hover:text-indigo-600 transition-colors flex-1"
                                                                                title="Open this question in Question Bank"
                                                                            >
                                                                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0 group-hover:text-indigo-600 transition-colors" />
                                                                                <span>"{q.text}"</span>
                                                                                <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
                                                                            </Link>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 py-1 italic">No relationship or questionnaire mapping details found.</p>
                                    )
                                ) : (
                                    <div className="space-y-1 text-slate-500 py-1">
                                        <p className="font-medium text-slate-700">Not currently used by any relationships or questionnaires.</p>
                                        <p className="text-xs text-slate-400">This field can still be completed as part of the Master Record.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Tabs defaultValue="note" className="w-full mt-6">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="note">Notes</TabsTrigger>
                            <TabsTrigger value="history">History Log</TabsTrigger>
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
                                    {displayHistoryEvents && displayHistoryEvents.length > 0 ? (
                                        displayHistoryEvents.map((item: any) => (
                                            <div key={item.id} className="relative pl-6">
                                                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white" />
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{formatSystemDateTime(item.timestamp, (session?.user as any)?.timezone || 'UTC')}</span>
                                                        <span>•</span>
                                                        <span className="font-medium text-slate-700">{item.assertedByUserName || item.actorId || "System"}</span>
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        {item.displayType === 'EXPLICIT_NONE' ? (
                                                            <span className="text-slate-500 italic">Source returned no value</span>
                                                        ) : item.displayType === 'DELETE' ? (
                                                            item.fromValue !== null ? (
                                                                <>Deleted value <span className="font-mono bg-slate-100 px-1 rounded">{renderRowValue(item.fromValue)}</span></>
                                                            ) : (
                                                                <span className="text-slate-500 italic">Previous value replaced</span>
                                                            )
                                                        ) : item.displayType === 'ADD' ? (
                                                            <>Changed value to <span className="font-mono bg-slate-100 px-1 rounded">{renderRowValue(item.toValue)}</span></>
                                                        ) : (
                                                            // UPDATE or EDIT_MERGED
                                                            item.fromValue !== null ? (
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    <div>Changed value</div>
                                                                    <div className="flex flex-col gap-0.5 text-xs">
                                                                        <div className="flex items-start gap-2">
                                                                            <span className="text-slate-400 w-10">From:</span>
                                                                            <span className="font-mono bg-red-50 text-red-700 px-1 rounded break-all">{renderRowValue(item.fromValue)}</span>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <span className="text-slate-400 w-10">To:</span>
                                                                            <span className="font-mono bg-emerald-50 text-emerald-700 px-1 rounded break-all">{renderRowValue(item.toValue)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>Changed value to <span className="font-mono bg-slate-100 px-1 rounded">{renderRowValue(item.toValue)}</span></>
                                                            )
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        via <FieldSourceBadge 
                                                                legacySourceType={item.source} 
                                                                legacySourceReference={item.actor} 
                                                                legacyRaId={registrationAuthorityId} 
                                                                legacyRaName={(registrationAuthorityId ? raNameMap[registrationAuthorityId] : undefined) || 'Registration Authority'}
                                                                variant="span"
                                                                className="uppercase tracking-wider"
                                                                wrapperClassName="flex items-center gap-1.5"
                                                            />
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
                                                        <FieldSourceBadge 
                                                            legacySourceType={candidate.source} 
                                                            legacySourceReference={candidate.sourceReference} 
                                                            legacyRaId={registrationAuthorityId} 
                                                            legacyRaName={(registrationAuthorityId ? raNameMap[registrationAuthorityId] : undefined) || 'Registration Authority'}
                                                            variant="span"
                                                            className="uppercase tracking-wider"
                                                            wrapperClassName="flex items-center gap-1.5"
                                                        />
                                                        {candidate.isAuthoritative && (
                                                            <Badge className="bg-indigo-600 text-white text-[9px] h-4 px-1.5 border-none">
                                                                Current Authoritative
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-semibold text-slate-900 break-all mb-1">
                                                        {(() => {
                                                            let parsed = candidate.value;
                                                            if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) { try { parsed = JSON.parse(parsed); } catch {} }

                                                            if (isPersonOrContactValue(parsed) || (parsed && typeof parsed === 'object' && ('ccPartyId' in parsed || 'legalName' in parsed || 'organisationName' in parsed))) {
                                                                const candCanonical = (candidate as any)?.canonicalDisplayModel;
                                                                const partyLabel = candCanonical?.value ? (candCanonical.value as any).partyLabel : (parsed?.legalName || parsed?.organisationName || undefined);
                                                                const partyVal = candCanonical?.value?.kind === 'partyRef' 
                                                                    ? candCanonical.value.resolved 
                                                                    : (candCanonical?.value?.kind === 'party' ? candCanonical.value.data : (parsed?.ccParty?.data || parsed?._resolvedData?.ccParty?.data || parsed));

                                                                return (
                                                                    <PersonOrContactValueViewer 
                                                                        value={partyVal} 
                                                                        partyLabel={partyLabel} 
                                                                        layout="detailed" 
                                                                        displayMask={data?.profileConfig?.displayMask} 
                                                                        claimId={candidate.id}
                                                                        isPromotedToCCC={candidate.isPromotedToCCC}
                                                                        isPromoting={isPromoting === candidate.id}
                                                                        onSaveForReuse={handleSaveForReuse}
                                                                        hideStatusBadge={fieldNo === 104}
                                                                    />
                                                                );
                                                            }
                                                            return renderRowValue(candidate.value, candidate);
                                                        })()}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <History className="w-3 h-3" />
                                                            {formatSystemDateTime(candidate.timestamp, (session?.user as any)?.timezone || 'UTC')}
                                                        </span>
                                                        {candidate.confidence !== null && (
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                {Math.round(candidate.confidence * 100)}% Confidence
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {!candidate.isAuthoritative && !(isPersonOrContactValue(candidate.value) || (candidate.value && typeof candidate.value === 'object' && ('ccPartyId' in candidate.value || 'legalName' in candidate.value || 'organisationName' in candidate.value))) && (
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
            
            {partyEditDialogState && (
                <CanonicalPartyEditDialog
                    open={partyEditDialogState.open}
                    onOpenChange={(open) => setPartyEditDialogState(open ? partyEditDialogState : null)}
                    clientLEId={clientLEId}
                    fieldNo={fieldNo}
                    rowId={partyEditDialogState.rowId}
                    ccPartyId={partyEditDialogState.ccPartyId}
                    legacyPartyData={partyEditDialogState.legacyPartyData}
                    onSuccess={async () => {
                        const refreshed = await getFieldDetail(clientLEId, fieldNo, 'CLIENT_LE', customFieldId);
                        setData(refreshed);
                        if (onUpdate && refreshed?.current) {
                            onUpdate(refreshed.current.value, refreshed.current.source, refreshed.current.timestamp || new Date());
                        }
                    }}
                />
            )}

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

