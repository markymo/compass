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
import { PersonOrContactValueEditor } from "@/components/client/fields/PersonOrContactValueEditor";
import { PartyValue, getPartySummary } from "@/lib/master-data/party-value";
import { upsertCCParty, deleteCCParty } from "@/actions/cc-party-actions";
import { Plus, Edit, Trash2, Loader2, Layers, AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CCPartyRecord {
    id: string;
    clientLEId: string;
    data: PartyValue;
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

const createBlankPartyValue = (): PartyValue => ({
    contactType: "PERSON",
    partyType: "INDIVIDUAL",
    partySubType: "PERSON",
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
    isActiveParty: true,
    isActivePersonOrContact: true,
    visibility: {
        scope: "CLIENT_LE",
    },
});

export function CCPartyManager({ clientLEId, initialParties }: CCPartyManagerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedParty, setSelectedParty] = useState<CCPartyRecord | null>(null);
    const [editorValue, setEditorValue] = useState<PartyValue>(createBlankPartyValue());

    const handleCreateClick = () => {
        setSelectedParty(null);
        setEditorValue(createBlankPartyValue());
        setDialogOpen(true);
    };

    const handleEditClick = (party: CCPartyRecord) => {
        setSelectedParty(party);
        setEditorValue(JSON.parse(JSON.stringify(party.data))); // Deep copy
        setDialogOpen(true);
    };

    const handleDeleteClick = (party: CCPartyRecord) => {
        setSelectedParty(party);
        setConfirmDeleteOpen(true);
    };

    const handleSave = () => {
        startTransition(async () => {
            try {
                const res = await upsertCCParty({
                    id: selectedParty?.id,
                    clientLEId,
                    data: editorValue,
                });

                if (res.success) {
                    toast.success(
                        selectedParty
                            ? "Curated party updated successfully"
                            : "Curated party created successfully"
                    );
                    setDialogOpen(false);
                    router.refresh();
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to save curated party");
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedParty) return;

        startTransition(async () => {
            try {
                const res = await deleteCCParty(selectedParty.id, clientLEId);
                if (res.success) {
                    toast.success("Curated party deleted successfully");
                    setConfirmDeleteOpen(false);
                    router.refresh();
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to delete curated party");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-base font-bold tracking-tight text-slate-800">
                        Curated Parties
                    </h3>
                    <p className="text-sm text-slate-500">
                        Manage local curated client representative parties for this entity.
                    </p>
                </div>
                <Button
                    onClick={handleCreateClick}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm flex items-center gap-1.5 shadow-sm transition-all duration-150 rounded-lg h-9 px-4"
                >
                    <Plus className="h-4 w-4" /> Add Curated Party
                </Button>
            </div>

            {/* Parties List Card */}
            <Card className="border-slate-200/80 shadow-xs overflow-hidden rounded-xl">
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Name
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Type / Subtype
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
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Scope
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialParties.map((party) => {
                                        const summary = getPartySummary(party.data);
                                        const isActive = party.data.isActiveParty !== false;
                                        const partySub = party.data.partySubType || party.data.contactType;
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
                                                        <span className="text-xs text-slate-400 capitalize">
                                                            {partySub.toLowerCase()}
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
                                                    <span className="text-xs text-slate-400 italic">No references yet</span>
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
                                                            title="Edit curated party"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteClick(party)}
                                                            className="h-8.5 w-8.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all duration-150"
                                                            title="Delete curated party"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
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
                <DialogContent className="max-w-4xl h-[85vh] md:h-[80vh] flex flex-col p-0 overflow-hidden border border-slate-100 shadow-xl rounded-xl">
                    <DialogHeader className="p-6 border-b border-slate-100/80 bg-white">
                        <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                            {selectedParty ? "Edit Curated Party" : "Add Curated Party"}
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
                                        <span className="text-slate-500 italic">No references yet</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                            <PersonOrContactValueEditor
                                value={editorValue}
                                onChange={setEditorValue}
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 rounded-b-xl">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-100 shadow-xl rounded-xl">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-rose-600">
                            <div className="p-2 bg-rose-50 rounded-full border border-rose-100">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-base font-bold">Delete Curated Party</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600 text-sm leading-relaxed pl-1">
                            Are you sure you want to delete this curated party record? This action is permanent and cannot be undone.
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
        </div>
    );
}
