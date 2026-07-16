"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CanonicalPartyEditor } from "@/components/client/fields/canonical-party-editor/CanonicalPartyEditor";
import { CanonicalPartyFormState, initialiseCanonicalPartyForm, buildCCPartyDataFromForm, EditorSubmissionCandidate } from "@/components/client/fields/canonical-party-editor/state-mappers";
import { CreateCCAddressDialog } from "@/components/client/fields/CreateCCAddressDialog";
import { PartyAddressRef } from "@/components/client/fields/CCAddressSelector";
import { getPartyLabel } from "@/lib/master-data/party-v2/label-helper";
import { upsertCCPartyV2, deleteCCParty } from "@/actions/cc-party-actions";
import { Plus, Edit, Trash2, Loader2, Layers, AlertTriangle, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StandardTooltip } from "@/components/ui/standard-tooltip";

interface CCPartyRecord {
    id: string;
    clientLEId: string;
    data: any;
    legacy?: any;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
    originType?: "MANUAL" | "PROMOTED";
    originLabel?: string;
    originFieldNo?: number;
    originFieldName?: string;
    originSourceLabel?: string;
    originClaimId?: string;
}

interface CCPartyManagerProps {
    clientLEId: string;
    initialParties: CCPartyRecord[];
}

const createBlankPartyForm = (): CanonicalPartyFormState => {
    return initialiseCanonicalPartyForm({
        party: {
            schemaVersion: 2,
            partyType: "INDIVIDUAL",
            isActiveParty: true,
            emails: [],
            phones: [],
            sourceIdentifiers: [],
            roles: []
        } as any
    } as any);
};

export function CCPartyManager({ clientLEId, initialParties }: CCPartyManagerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedParty, setSelectedParty] = useState<CCPartyRecord | null>(null);
    const [editorValue, setEditorValue] = useState<CanonicalPartyFormState>(createBlankPartyForm());
    const [omissionsContext, setOmissionsContext] = useState<EditorSubmissionCandidate | null>(null);
    const [addressCreateContext, setAddressCreateContext] = useState<((ref: PartyAddressRef) => void) | null>(null);

    const handleCreateClick = () => {
        setSelectedParty(null);
        setEditorValue(createBlankPartyForm());
        setDialogOpen(true);
    };

    const handleEditClick = (party: CCPartyRecord) => {
        setSelectedParty(party);
        setEditorValue(initialiseCanonicalPartyForm({ party: party.data, legacy: party.legacy } as any));
        setDialogOpen(true);
    };

    const handleDeleteClick = (party: CCPartyRecord) => {
        setSelectedParty(party);
        setConfirmDeleteOpen(true);
    };

    const executeSave = (candidateData: any) => {
        startTransition(async () => {
            try {
                const res = await upsertCCPartyV2({
                    id: selectedParty?.id,
                    clientLEId,
                    data: candidateData,
                });

                if (res.success) {
                    toast.success(
                        selectedParty
                            ? "Saved party updated successfully"
                            : "Saved party created successfully"
                    );
                    setDialogOpen(false);
                    setOmissionsContext(null);
                    router.refresh();
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to save saved party");
            }
        });
    };

    const handleSave = () => {
        const candidate = buildCCPartyDataFromForm(
            editorValue, 
            selectedParty ? ({ party: selectedParty.data, legacy: selectedParty.legacy } as any) : undefined
        );
        
        if (!candidate.isValid) {
            toast.error("Please fill out all required fields.");
            return;
        }

        if (candidate.destructiveOmissions.length > 0) {
            setOmissionsContext(candidate);
            return;
        }

        executeSave(candidate.data);
    };

    const handleConfirmDelete = () => {
        if (!selectedParty) return;

        startTransition(async () => {
            try {
                const res = await deleteCCParty(selectedParty.id, clientLEId);
                if (res.success) {
                    toast.success("Saved party deleted successfully");
                    setConfirmDeleteOpen(false);
                    router.refresh();
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to delete saved party");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-base font-bold tracking-tight text-slate-800">
                        Parties
                    </h3>
                </div>
                <Button
                    onClick={handleCreateClick}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm flex items-center gap-1.5 shadow-sm transition-all duration-150 rounded-lg h-9 px-4"
                >
                    <Plus className="h-4 w-4" /> Party
                </Button>
            </div>

            {/* Parties List Card */}
            <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white">
                <CardContent className="p-0">
                    {initialParties.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-3 bg-slate-50 rounded-full border border-slate-100 text-slate-400 mb-4">
                                <Layers className="h-6 w-6" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">No Curated Parties</h4>
                            <p className="text-xs text-slate-500 max-w-sm mt-1">
                                No curated representative records have been created for this legal entity yet.
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleCreateClick}
                                className="mt-5 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg h-8 px-3"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Your First Party
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full">
                            <Table>
                                <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Name
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Type
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Status
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Origin
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Usage
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider font-mono">
                                            Scope
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialParties.map((party) => {
                                        const summary = party.data ? getPartyLabel({ party: party.data, legacy: party.legacy || {} } as any) : "Unknown";
                                        const isActive = party.data.isActiveParty !== false;
                                        const usage = (party as any).usage;
                                        return (
                                            <TableRow key={party.id} className="hover:bg-slate-50/40 border-b border-slate-100 last:border-0 transition-colors duration-150">
                                                <TableCell className="py-3 px-5 font-semibold text-slate-800 text-sm">
                                                    {summary}
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs text-slate-500 tracking-wide">
                                                            {party.data.partyType || "UNKNOWN"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm">
                                                    <Badge
                                                        className={
                                                            isActive
                                                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60 font-semibold px-2 py-0.5 rounded-md"
                                                                : "bg-slate-50 text-slate-500 hover:bg-slate-50 border border-slate-200 font-semibold px-2 py-0.5 rounded-md"
                                                        }
                                                    >
                                                        {isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm">
                                                    <div className="flex flex-col gap-0.5 max-w-[200px]">
                                                        {party.originType === 'PROMOTED' ? (
                                                            <>
                                                                <span className="font-semibold text-xs text-indigo-600 truncate" title={party.originLabel}>
                                                                    {party.originLabel}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    Source: {party.originSourceLabel || 'Unknown'}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="font-semibold text-xs text-slate-600 truncate">
                                                                {party.originLabel || 'Manual'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm">
                                                    {usage && usage.length > 0 ? (
                                                        <StandardTooltip 
                                                            dottedUnderline={true}
                                                            content={
                                                                <div className="flex flex-col gap-1 text-left">
                                                                    {usage.map((u: any) => (
                                                                        <span key={u.fieldNo} className="text-xs">
                                                                            Field {u.fieldNo} — {u.fieldName}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            }
                                                        >
                                                            <span className="font-semibold text-xs text-slate-700 cursor-default">Used in {usage.length} field{usage.length !== 1 ? 's' : ''}</span>
                                                        </StandardTooltip>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Not currently used</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-xs font-semibold text-slate-400 font-mono">
                                                    {party.visibility}
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditClick(party)}
                                                            className="h-8.5 w-8.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all duration-150"
                                                            title="Edit saved party"
                                                            aria-label="Edit saved party"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8.5 w-8.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-all duration-150"
                                                                    aria-label="More actions"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteClick(party)}
                                                                    className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>


            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-100 shadow-xl rounded-xl">
                    <DialogHeader className="p-6 border-b border-slate-100/80 bg-white">
                        <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                            {selectedParty ? "Edit saved party" : "Add saved party"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm mt-1">
                            Fill in the fields below to curate this party's representative record.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/30">
                        {/* Metadata Panel */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visibility</label>
                                <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                                    {selectedParty?.visibility || "CLIENT_LE"}
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin & Usage</label>
                                <div className="text-xs text-slate-600 flex flex-col gap-1">
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-semibold text-slate-700 min-w-[50px]">Origin:</span>
                                        <span>
                                            {selectedParty ? (
                                                selectedParty.originType === 'PROMOTED' 
                                                    ? `${selectedParty.originLabel}${selectedParty.originSourceLabel ? ` (${selectedParty.originSourceLabel})` : ''}`
                                                    : selectedParty.originLabel || "Manual"
                                            ) : "Manual creation"}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-semibold text-slate-700 min-w-[50px]">Usage:</span>
                                        {selectedParty && (selectedParty as any).usage && (selectedParty as any).usage.length > 0 ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-semibold text-indigo-600">
                                                    Used in {(selectedParty as any).usage.length} field{(selectedParty as any).usage.length !== 1 ? 's' : ''}
                                                </span>
                                                {(selectedParty as any).usage.map((u: any) => (
                                                    <span key={u.fieldNo} className="text-[10px] text-slate-500 max-w-[200px] truncate" title={`Field ${u.fieldNo} — ${u.fieldName}`}>
                                                        Field {u.fieldNo} — {u.fieldName}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 italic">No references yet</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                            <CanonicalPartyEditor
                                clientLEId={clientLEId}
                                formState={editorValue}
                                onChange={setEditorValue}
                                disabled={isPending}
                                isNew={!selectedParty}
                                previewLabel={(editorValue && getPartyLabel({ party: buildCCPartyDataFromForm(editorValue).data || editorValue as any } as any)) || "Unnamed Party"}
                                onRequestCreateAddress={(onCreated) => setAddressCreateContext(() => onCreated)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 rounded-b-xl">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDialogOpen(false);
                                setAddressCreateContext(null);
                            }}
                            disabled={isPending}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-4 text-sm font-semibold rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px] h-9 px-4 text-sm font-semibold rounded-lg shadow-sm transition-all duration-150"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Omissions Confirmation Dialog */}
            <Dialog open={!!omissionsContext} onOpenChange={(open) => !open && setOmissionsContext(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden border border-amber-100 shadow-xl rounded-xl">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-amber-600">
                            <div className="p-2 bg-amber-50 rounded-full border border-amber-100">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-base font-bold">Confirm Address Removal</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600 text-sm leading-relaxed pl-1">
                            Saving this party will permanently drop the following legacy embedded addresses. They will be removed from the master record.
                            <ul className="mt-2 list-disc list-inside text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                {omissionsContext?.destructiveOmissions.map((o, idx) => (
                                    <li key={idx}><strong>{o.displayValue}</strong> ({o.addressRole})</li>
                                ))}
                            </ul>
                        </DialogDescription>
                    </div>
                    <DialogFooter className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-xl">
                        <Button
                            variant="outline"
                            onClick={() => setOmissionsContext(null)}
                            disabled={isPending}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-4 text-sm font-semibold rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => omissionsContext && executeSave(omissionsContext.data)}
                            disabled={isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 text-sm font-semibold rounded-lg shadow-sm transition-all duration-150"
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Proceed & Drop Addresses"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-100 shadow-xl rounded-xl">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-rose-600">
                            <div className="p-2 bg-rose-50 rounded-full border border-rose-100">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-base font-bold">Delete saved party</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600 text-sm leading-relaxed pl-1">
                            Are you sure you want to delete this saved party record? This action is permanent and cannot be undone.
                        </DialogDescription>
                    </div>

                    <DialogFooter className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-xl">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDeleteOpen(false)}
                            disabled={isPending}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-4 text-sm font-semibold rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmDelete}
                            disabled={isPending}
                            className="bg-rose-600 hover:bg-rose-700 text-white h-9 px-4 text-sm font-semibold rounded-lg shadow-sm transition-all duration-150"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                "Delete Record"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CreateCCAddressDialog
                clientLEId={clientLEId}
                open={addressCreateContext !== null}
                onOpenChange={(open) => {
                    if (!open) setAddressCreateContext(null);
                }}
                onSuccess={(ref) => {
                    if (addressCreateContext) {
                        addressCreateContext(ref);
                    }
                }}
            />
        </div>
    );
}
