"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { searchClients } from "@/actions/super-admin-users";
import { useDebounce } from "@/hooks/use-debounce"; // Assuming we have one, or I'll implement simple local debounce

interface ClientSelectorProps {
    value?: string;
    onChange: (value: string) => void;
}

export function ClientSelector({ value, onChange }: ClientSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [clients, setClients] = React.useState<{ id: string, name: string }[]>([]);
    const [selectedName, setSelectedName] = React.useState("");

    // Simple debounce effect
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (query) fetchClients(query);
            else fetchClients(""); // Fetch defaults
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Initial load
    React.useEffect(() => {
        fetchClients("");
    }, []);

    async function fetchClients(q: string) {
        const res = await searchClients(q);
        setClients(res);
        // Update selected name if value exists
        if (value) {
            const found = res.find(c => c.id === value);
            if (found) setSelectedName(found.name);
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[300px] justify-between"
                >
                    {value
                        ? (selectedName || "Client selected")
                        : "Select client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-white dark:bg-slate-950 z-50 shadow-md border">
                <Command>
                    <CommandInput placeholder="Search client..." onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                            {clients.map((client) => (
                                <CommandItem
                                    key={client.id}
                                    value={client.id} // Shadcn command usually uses label for search, but we drive it manually
                                    onSelect={(currentValue) => {
                                        onChange(client.id);
                                        setSelectedName(client.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === client.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {client.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
