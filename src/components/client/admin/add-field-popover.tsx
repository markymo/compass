"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { addFieldToGroup, getAvailableFieldsForGroup } from "@/actions/master-data-governance";

type AvailableField = {
    fieldNo: number;
    fieldName: string;
    appDataType: string;
};

interface AddFieldPopoverProps {
    groupId: string;
}

export function AddFieldPopover({ groupId }: AddFieldPopoverProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [fields, setFields] = useState<AvailableField[]>([]);
    const [fetching, setFetching] = useState(false);
    const [adding, setAdding] = useState<number | null>(null); // fieldNo being added

    const handleOpenChange = async (nextOpen: boolean) => {
        setOpen(nextOpen);
        // Lazy-load available fields the first time the popover opens.
        // Re-fetch each time it opens so the list stays in sync with
        // fields added during the same page session.
        if (nextOpen) {
            setFetching(true);
            try {
                const res = await getAvailableFieldsForGroup(groupId);
                setFields(res.fields ?? []);
            } catch {
                toast.error("Failed to load available fields");
            } finally {
                setFetching(false);
            }
        }
    };

    const handleSelect = async (fieldNo: number) => {
        setAdding(fieldNo);
        try {
            const res = await addFieldToGroup(groupId, fieldNo);
            if (res.success) {
                toast.success("Field added to group");
                // Remove the added field from the local list immediately so the
                // popover feels responsive before router.refresh() completes.
                setFields(prev => prev.filter(f => f.fieldNo !== fieldNo));
                setOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to add field");
            }
        } finally {
            setAdding(null);
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-dashed text-slate-500 hover:text-slate-900 hover:border-slate-400 dark:hover:text-slate-100"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Field
                    <ChevronsUpDown className="h-3 w-3 opacity-40" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="end" sideOffset={4}>
                <Command shouldFilter={true}>
                    <CommandInput placeholder="Search fields by name or number…" />
                    <CommandList>
                        {fetching ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : (
                            <>
                                <CommandEmpty className="py-6 text-center text-xs text-slate-400">
                                    No available fields. All active fields may already be in this group.
                                </CommandEmpty>
                                <CommandGroup heading="Active fields not yet in this group">
                                    {fields.map(f => (
                                        <CommandItem
                                            key={f.fieldNo}
                                            // Include both name and number so search finds either
                                            value={`${f.fieldName} ${f.fieldNo}`}
                                            onSelect={() => handleSelect(f.fieldNo)}
                                            disabled={adding === f.fieldNo}
                                            className="flex items-center justify-between cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {adding === f.fieldNo ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-purple-500" />
                                                ) : (
                                                    <span className="font-mono text-[10px] text-slate-400 w-8 shrink-0">
                                                        #{f.fieldNo}
                                                    </span>
                                                )}
                                                <span className="truncate font-medium text-sm">
                                                    {f.fieldName}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded shrink-0 ml-2">
                                                {f.appDataType}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
