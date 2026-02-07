"use client";

import { useState, useEffect } from "react";
import { getDemoActors } from "@/actions/demo-actions";
import { generateImpersonationToken } from "@/actions/demo-actions";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Presentation, Loader2, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DemoSwitcher() {
    const [open, setOpen] = useState(false);
    const [actors, setActors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        if (open && actors.length === 0) {
            setLoading(true);
            getDemoActors().then(data => {
                setActors(data);
                setLoading(false);
            });
        }
    }, [open, actors.length]);

    async function handleImpersonate(actorId: string) {
        setSwitching(true);
        try {
            const res = await generateImpersonationToken(actorId);
            if (res.success && res.token) {
                toast.success("Entering Demo Mode...");
                await signIn("credentials", {
                    token: res.token,
                    redirect: true,
                    callbackUrl: "/app"
                });
            } else {
                toast.error(res.error || "Failed to generate token");
                setSwitching(false);
            }
        } catch (e) {
            console.error(e);
            toast.error("An error occurred");
            setSwitching(false);
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                    <Presentation className="h-4 w-4" />
                    <span className="hidden md:inline-block font-medium">Demo</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Search demo actors..." />
                    <CommandList>
                        <CommandEmpty>No demo actors found.</CommandEmpty>
                        <CommandGroup heading="Available Actors">
                            {loading && (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            {!loading && actors.map((actor) => (
                                <CommandItem
                                    key={actor.id}
                                    onSelect={() => handleImpersonate(actor.id)}
                                    className="cursor-pointer"
                                    disabled={switching}
                                >
                                    <User className="mr-2 h-4 w-4 opacity-50" />
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">{actor.name}</span>
                                        <span className="text-xs text-muted-foreground">{actor.email}</span>
                                    </div>
                                    {switching && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {!loading && actors.length === 0 && (
                            <div className="p-4 text-xs text-center text-muted-foreground">
                                No users marked as "Demo Actor" found.
                                <br />Go to Users admin to add some.
                            </div>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
