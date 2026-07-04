"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    ChevronUp,
    ChevronDown,
    Eye,
    EyeOff,
    Trash2,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    removeGroupItem,
    reorderGroupItems,
    toggleGroupItemPickerVisibility,
} from "@/actions/master-data-governance";
import { AddFieldPopover } from "./add-field-popover";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

export type GroupItem = {
    id: string;
    fieldNo: number;
    order: number;
    hideFromFieldPicker: boolean;
    field: { fieldName: string; appDataType: string } | null;
};

export type GroupForTable = {
    id: string;
    key: string;
    items: GroupItem[];
};

interface GroupItemsTableProps {
    group: GroupForTable;
}

export function GroupItemsTable({ group }: GroupItemsTableProps) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null); // itemId of in-flight action, or 'add'
    const [itemToRemove, setItemToRemove] = useState<GroupItem | null>(null);

    // Items arrive pre-sorted by order from the server query.
    // Re-sort defensively in case order values drift.
    const items = [...group.items].sort((a, b) => a.order - b.order);

    const withBusy = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        try {
            await fn();
        } finally {
            setBusy(null);
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const reordered = [...items];
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        await withBusy(items[index].id, async () => {
            const res = await reorderGroupItems(group.id, reordered.map(i => i.id));
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Failed to reorder");
            }
        });
    };

    const handleMoveDown = async (index: number) => {
        if (index === items.length - 1) return;
        const reordered = [...items];
        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        await withBusy(items[index].id, async () => {
            const res = await reorderGroupItems(group.id, reordered.map(i => i.id));
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Failed to reorder");
            }
        });
    };

    const handleTogglePicker = async (item: GroupItem) => {
        await withBusy(item.id, async () => {
            const res = await toggleGroupItemPickerVisibility(item.id, !item.hideFromFieldPicker);
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Failed to update picker visibility");
            }
        });
    };

    const confirmRemove = async () => {
        if (!itemToRemove) return;
        await withBusy(itemToRemove.id, async () => {
            const res = await removeGroupItem(itemToRemove.id);
            if (res.success) {
                toast.success("Field removed from group");
                setItemToRemove(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to remove field");
            }
        });
    };

    return (
        <div>
            <ConfirmDeleteDialog
                open={!!itemToRemove}
                onOpenChange={(open) => { if (!open) setItemToRemove(null); }}
                title={`Remove "${itemToRemove?.field?.fieldName ?? `Field ${itemToRemove?.fieldNo}`}"?`}
                description="This will remove the field from this group. This does not delete the field itself."
                onConfirm={confirmRemove}
                isLoading={itemToRemove ? busy === itemToRemove.id : false}
                confirmLabel="Remove"
            />
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="pl-6 w-[80px] text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Order
                        </TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Linked Field
                        </TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center w-[140px]">
                            Picker Visibility
                        </TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right pr-6 w-[100px]">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => {
                        const isBusy = busy === item.id;
                        return (
                            <TableRow
                                key={item.id}
                                className="group/row hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                            >
                                {/* Order badge + move controls */}
                                <TableCell className="pl-6">
                                    <div className="flex items-center gap-1">
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-[10px] border-slate-100 dark:border-slate-800 text-slate-400 px-1.5 min-w-[24px] justify-center"
                                        >
                                            {item.order}
                                        </Badge>
                                        <div className="flex flex-col opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 text-slate-400 hover:text-slate-700"
                                                disabled={index === 0 || isBusy}
                                                onClick={() => handleMoveUp(index)}
                                                title="Move up"
                                            >
                                                {isBusy ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ChevronUp className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 text-slate-400 hover:text-slate-700"
                                                disabled={index === items.length - 1 || isBusy}
                                                onClick={() => handleMoveDown(index)}
                                                title="Move down"
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </TableCell>

                                {/* Field name */}
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {item.field?.fieldName ?? `Field ${item.fieldNo}`}
                                        </span>
                                        <span className="text-[10px] text-slate-300 font-mono tracking-tighter">
                                            (No. {item.fieldNo})
                                        </span>
                                        {item.field?.appDataType && (
                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                {item.field.appDataType}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>

                                {/* Picker visibility toggle */}
                                <TableCell className="text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 gap-1.5"
                                        disabled={isBusy}
                                        onClick={() => handleTogglePicker(item)}
                                        title={
                                            item.hideFromFieldPicker
                                                ? "Click to make visible standalone"
                                                : "Click to hide standalone"
                                        }
                                    >
                                        {item.hideFromFieldPicker ? (
                                            <>
                                                <EyeOff className="h-3 w-3 text-amber-500" />
                                                <span className="text-[10px] text-amber-600 font-bold">
                                                    Hides Standalone
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-3 w-3 text-emerald-500" />
                                                <span className="text-[10px] text-emerald-600 font-medium">
                                                    Visible Standalone
                                                </span>
                                            </>
                                        )}
                                    </Button>
                                </TableCell>

                                {/* Remove */}
                                <TableCell className="text-right pr-6">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                        disabled={isBusy}
                                        onClick={() => setItemToRemove(item)}
                                        title="Remove from group"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}

                    {items.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="h-16 text-center text-xs text-slate-400 italic"
                            >
                                No fields mapped to this group yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Add Field footer */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <AddFieldPopover groupId={group.id} />
            </div>
        </div>
    );
}
