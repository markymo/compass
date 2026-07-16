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
import { AddressValueEditor } from "@/components/client/fields/AddressValueEditor";
import { AddressValue, getAddressSummary } from "@/components/client/fields/AddressValueViewer";
import { upsertCCAddress, deleteCCAddress } from "@/actions/cc-address-actions";
import { Plus, Edit, Trash2, Loader2, Layers, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CCAddressRecord {
    id: string;
    clientLEId: string;
    data: AddressValue;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
    originType?: "MANUAL" | "PROMOTED";
    originLabel?: string;
    originFieldNo?: number;
    originFieldName?: string;
    originSourceLabel?: string;
    originClaimId?: string;
    usage?: import("@/actions/cc-address-usage-resolver").CCAddressUsageSummary;
}

interface CCAddressManagerProps {
    clientLEId: string;
    initialAddresses: CCAddressRecord[];
}

const createBlankAddressValue = (): AddressValue => ({
    addressLines: [""],
    locality: null,
    region: null,
    postalCode: null,
    countryCode: null,
});

export function CCAddressManager({ clientLEId, initialAddresses }: CCAddressManagerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<CCAddressRecord | null>(null);
    const [editorValue, setEditorValue] = useState<AddressValue>(createBlankAddressValue());

    const handleCreateClick = () => {
        setSelectedAddress(null);
        setEditorValue(createBlankAddressValue());
        setDialogOpen(true);
    };

    const handleEditClick = (address: CCAddressRecord) => {
        setSelectedAddress(address);
        setEditorValue(JSON.parse(JSON.stringify(address.data))); // Deep copy
        setDialogOpen(true);
    };

    const handleDeleteClick = (address: CCAddressRecord) => {
        setSelectedAddress(address);
        setConfirmDeleteOpen(true);
    };

    const handleSave = () => {
        startTransition(async () => {
            try {
                const res = await upsertCCAddress({
                    id: selectedAddress?.id,
                    clientLEId,
                    data: editorValue,
                });

                if (res.success) {
                    toast.success(
                        selectedAddress
                            ? "Saved address updated successfully"
                            : "Saved address created successfully"
                    );
                    setDialogOpen(false);
                    router.refresh();
                } else {
                    toast.error(res.error || "Failed to save saved address");
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to save saved address");
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedAddress) return;

        startTransition(async () => {
            try {
                const res = await deleteCCAddress(selectedAddress.id, clientLEId);
                if (res.success) {
                    toast.success("Saved address deleted successfully");
                    setConfirmDeleteOpen(false);
                    router.refresh();
                } else {
                    toast.error(res.error || "Failed to delete saved address");
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to delete saved address");
            }
        });
    };

    return (
        <div className="space-y-6 mt-10">
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-base font-bold tracking-tight text-slate-800">
                        Addresses
                    </h3>
                </div>
                <Button
                    onClick={handleCreateClick}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm flex items-center gap-1.5 shadow-sm transition-all duration-150 rounded-lg h-9 px-4"
                >
                    <Plus className="h-4 w-4" /> Address
                </Button>
            </div>

            {/* Addresses List Card */}
            <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white">
                <CardContent className="p-0">
                    {initialAddresses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-3 bg-slate-50 rounded-full border border-slate-100 text-slate-400 mb-4">
                                <Layers className="h-6 w-6" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">No saved addresses</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                No saved address records have been created for this legal entity yet.
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleCreateClick}
                                className="mt-5 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg h-8 px-3"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Your First Address
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full">
                            <Table>
                                <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Summary
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Origin
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Usage
                                        </TableHead>

                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialAddresses.map((address) => {
                                        const summary = getAddressSummary(address.data) || "Incomplete Address";
                                        const usage = (address as any).usage;
                                        return (
                                            <TableRow key={address.id} className="hover:bg-slate-50/40 border-b border-slate-100 last:border-0 transition-colors duration-150">
                                                <TableCell className="py-3 px-5 font-semibold text-slate-800 text-sm whitespace-normal break-words max-w-[300px]">
                                                    {summary}
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm whitespace-normal">
                                                    <div className="flex flex-col gap-0.5 max-w-[200px]">
                                                        {address.originType === 'PROMOTED' ? (
                                                            <>
                                                                <span className="font-semibold text-xs text-indigo-600 truncate" title={address.originLabel}>
                                                                    {address.originLabel}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    Source: {address.originSourceLabel || 'Unknown'}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="font-semibold text-xs text-slate-600 truncate">
                                                                {address.originLabel || 'Manual'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-5 text-sm whitespace-normal">
                                                    {usage && (usage.partyUsages.length > 0 || usage.fieldUsages.length > 0) ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-semibold text-xs text-slate-700">
                                                                Used by {usage.partyUsages.length} party record{usage.partyUsages.length !== 1 ? 's' : ''}, {usage.fieldUsages.length} field reference{usage.fieldUsages.length !== 1 ? 's' : ''}
                                                            </span>
                                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                                {usage.partyUsages.slice(0, 2).map((u: any, idx: number) => (
                                                                    <span key={`p-${idx}`} className="text-[10px] text-slate-500 max-w-[180px] truncate" title={`${u.partyLabel} — ${u.usageKind.replace(/_/g, ' ')}`}>
                                                                        Party record: {u.partyLabel}
                                                                    </span>
                                                                ))}
                                                                {usage.fieldUsages.slice(0, Math.max(0, 3 - usage.partyUsages.length)).map((u: any) => (
                                                                    <span key={`f-${u.fieldNo}`} className="text-[10px] text-slate-500 max-w-[180px] truncate" title={`Field reference ${u.fieldNo} — ${u.fieldName}`}>
                                                                        Field reference {u.fieldNo} — {u.fieldName}
                                                                    </span>
                                                                ))}
                                                                {(usage.partyUsages.length + usage.fieldUsages.length) > 3 && (
                                                                    <span className="text-[10px] text-slate-400 italic">+{usage.partyUsages.length + usage.fieldUsages.length - 3} more...</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No references yet</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="py-3 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditClick(address)}
                                                            className="h-8.5 w-8.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all duration-150"
                                                            title="Edit saved address"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteClick(address)}
                                                            className="h-8.5 w-8.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all duration-150"
                                                            title="Delete saved address"
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
                            {selectedAddress ? "Edit saved address" : "Add saved address"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm mt-1">
                            Fill in the fields below to curate this address record.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/30">
                        {/* Metadata Panel */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visibility</label>
                                <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                                    {selectedAddress?.visibility || "CLIENT_LE"}
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin & Usage</label>
                                <div className="text-xs text-slate-600 flex flex-col gap-1">
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-semibold text-slate-700 min-w-[50px]">Origin:</span>
                                        <span>
                                            {selectedAddress ? (
                                                selectedAddress.originType === 'PROMOTED' 
                                                    ? `${selectedAddress.originLabel}${selectedAddress.originSourceLabel ? ` (${selectedAddress.originSourceLabel})` : ''}`
                                                    : selectedAddress.originLabel || "Manual"
                                            ) : "Manual creation"}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-semibold text-slate-700 min-w-[50px]">Usage:</span>
                                        {selectedAddress && selectedAddress.usage && (selectedAddress.usage.partyUsages.length > 0 || selectedAddress.usage.fieldUsages.length > 0) ? (
                                            <div className="flex flex-col gap-2">
                                                {selectedAddress.usage.partyUsages.length > 0 && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-semibold text-indigo-600">
                                                            Used by {selectedAddress.usage.partyUsages.length} part{selectedAddress.usage.partyUsages.length !== 1 ? 'ies' : 'y'}
                                                        </span>
                                                        {selectedAddress.usage.partyUsages.map((u: any, idx: number) => (
                                                            <span key={`p-${idx}`} className="text-[10px] text-slate-500 max-w-[200px] truncate" title={`${u.partyLabel} — ${u.usageKind.replace(/_/g, ' ')}`}>
                                                                {u.partyLabel} <span className="text-slate-400 font-normal">({u.usageKind.replace(/_/g, ' ').toLowerCase()})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectedAddress.usage.fieldUsages.length > 0 && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-semibold text-indigo-600">
                                                            Used in {selectedAddress.usage.fieldUsages.length} field{selectedAddress.usage.fieldUsages.length !== 1 ? 's' : ''}
                                                        </span>
                                                        {selectedAddress.usage.fieldUsages.map((u: any) => (
                                                            <span key={`f-${u.fieldNo}`} className="text-[10px] text-slate-500 max-w-[200px] truncate" title={`Field ${u.fieldNo} — ${u.fieldName}`}>
                                                                Field {u.fieldNo} — {u.fieldName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 italic">Not currently used by any Party or Field</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                            <AddressValueEditor
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
                            <DialogTitle className="text-base font-bold">Delete saved address</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600 text-sm leading-relaxed pl-1">
                            Are you sure you want to delete this saved address record? This action is permanent and cannot be undone.
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
