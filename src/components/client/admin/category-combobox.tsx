"use client";

import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CategoryComboboxProps {
    categories: any[];
    categoryId: string | undefined | null;
    newCategoryName?: string;
    onSelectionChange: (categoryId: string, newCategoryName: string) => void;
    onClose?: () => void;
    placeholder?: string;
    className?: string;
    defaultOpen?: boolean;
}

export function CategoryCombobox({ 
    categories, 
    categoryId, 
    newCategoryName,
    onSelectionChange, 
    onClose,
    placeholder = "Select or create category...",
    className,
    defaultOpen = false
}: CategoryComboboxProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [search, setSearch] = useState("");

    const handleOpenChange = (val: boolean) => {
        setOpen(val);
        if (!val && onClose && !search) {
            onClose(); // only strictly cancel if they just clicked away without submitting
        }
    };

    const displayValue = categoryId 
        ? categories.find(c => c.id === categoryId)?.displayName 
        : (newCategoryName || placeholder);

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    role="combobox" 
                    aria-expanded={open} 
                    className={cn("w-full justify-between bg-white text-left font-normal h-9", className)}
                >
                    {displayValue}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search or create category..." value={search} onValueChange={setSearch} />
                    <CommandList>
                        {search && (
                            <CommandEmpty className="p-2 text-sm text-center text-slate-500">
                                No category found. <br />
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="mt-2 w-full" 
                                    onClick={() => {
                                        onSelectionChange("", search);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    Create "{search}"
                                </Button>
                            </CommandEmpty>
                        )}
                        <CommandGroup>
                            {categories.map((c) => (
                                <CommandItem
                                    key={c.id}
                                    value={c.displayName}
                                    onSelect={() => {
                                        onSelectionChange(c.id, "");
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", categoryId === c.id ? "opacity-100" : "opacity-0")} />
                                    {c.displayName}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
