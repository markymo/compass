"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressValue } from "./AddressValueViewer";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { COUNTRY_CODES } from "@/lib/master-data/countries";

interface AddressValueEditorProps {
    value: AddressValue | null | undefined;
    onChange: (value: AddressValue) => void;
    disabled?: boolean;
}

export function AddressValueEditor({ value, onChange, disabled }: AddressValueEditorProps) {
    const addr = value || {};
    const lines = addr.addressLines || [];
    const [countryOpen, setCountryOpen] = useState(false);

    const handleLineChange = (index: number, newText: string) => {
        const newLines = [...lines];
        newLines[index] = newText;
        onChange({ ...addr, addressLines: newLines });
    };

    const handleAddLine = () => {
        onChange({ ...addr, addressLines: [...lines, ""] });
    };

    const handleRemoveLine = (index: number) => {
        const newLines = lines.filter((_, i) => i !== index);
        onChange({ ...addr, addressLines: newLines });
    };

    const handleChange = (field: keyof AddressValue, val: string) => {
        onChange({ ...addr, [field]: val || null });
    };

    return (
        <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50/50 p-4">
            <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Address Lines</Label>
                {lines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            value={line}
                            onChange={(e) => handleLineChange(i, e.target.value)}
                            disabled={disabled}
                            placeholder={`Address Line ${i + 1}`}
                            className="bg-white"
                        />
                        <button
                            type="button"
                            onClick={() => handleRemoveLine(i)}
                            disabled={disabled}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors text-xs font-semibold"
                        >
                            ✕
                        </button>
                    </div>
                ))}
                {!disabled && (
                    <button
                        type="button"
                        onClick={handleAddLine}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors mt-1 inline-flex items-center gap-1"
                    >
                        + Add line
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Locality / City</Label>
                    <Input
                        value={addr.locality || ""}
                        onChange={(e) => handleChange("locality", e.target.value)}
                        disabled={disabled}
                        className="bg-white h-8 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Region</Label>
                    <Input
                        value={addr.region || ""}
                        onChange={(e) => handleChange("region", e.target.value)}
                        disabled={disabled}
                        className="bg-white h-8 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Postal Code</Label>
                    <Input
                        value={addr.postalCode || ""}
                        onChange={(e) => handleChange("postalCode", e.target.value)}
                        disabled={disabled}
                        className="bg-white h-8 text-sm uppercase"
                    />
                </div>
                <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Country</Label>
                    <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={countryOpen}
                                disabled={disabled}
                                className={cn("w-full justify-between bg-white text-left font-normal h-8 text-sm px-3", !addr.countryCode && "text-slate-500")}
                            >
                                {addr.countryName || (addr.countryCode ? COUNTRY_CODES[addr.countryCode.toUpperCase()] || addr.countryCode : "Select country...")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandList>
                                    <CommandEmpty>No country found.</CommandEmpty>
                                    <CommandGroup>
                                        {Object.entries(COUNTRY_CODES).map(([code, name]) => (
                                            <CommandItem
                                                key={code}
                                                value={name} // CommandItem matches by value
                                                onSelect={() => {
                                                    onChange({ ...addr, countryCode: code, countryName: name, rawCountry: null });
                                                    setCountryOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", addr.countryCode?.toUpperCase() === code ? "opacity-100" : "opacity-0")} />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}
