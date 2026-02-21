"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Plus, X } from "lucide-react";
import { inviteUser } from "@/actions/invitations";
import { getClientLEs } from "@/actions/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Permission Level Constants
const PERM_LEVELS = [
    { value: "ORG_ADMIN", label: "Client Admin (Billing & Org Mgmt)" },
    { value: "LE_ADMIN", label: "Legal Entity Admin" },
    { value: "LE_USER", label: "Legal Entity User" }
];

export function InviteMemberDialog({ orgId }: { orgId: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [leOptions, setLeOptions] = useState<{ id: string, name: string }[]>([]);

    const [email, setEmail] = useState("");
    const [permLevel, setPermLevel] = useState("LE_USER");

    // Multi-Select State for LEs
    const [selectedLEs, setSelectedLEs] = useState<string[]>([]);
    const [comboboxOpen, setComboboxOpen] = useState(false);

    // Fetch LEs when dialog opens
    useEffect(() => {
        if (open && leOptions.length === 0) {
            getClientLEs(orgId).then(les => setLeOptions(les));
        }
    }, [open, orgId, leOptions.length]);

    const isOrgLevel = permLevel === "ORG_ADMIN";
    const isLeLevel = permLevel === "LE_ADMIN" || permLevel === "LE_USER";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        if (isOrgLevel) {
            // Single org-level invite
            const res = await inviteUser({ email, role: permLevel, organizationId: orgId });
            setLoading(false);
            if (res.success) { setOpen(false); setEmail(""); setSelectedLEs([]); }
            else alert(res.error);
            return;
        }

        // Multi LE: fire one invite per LE
        const lesToInvite = selectedLEs.length > 0 ? selectedLEs : [];
        if (lesToInvite.length === 0) { setLoading(false); return; }

        const results = await Promise.all(
            lesToInvite.map(leId => inviteUser({ email, role: permLevel, clientLEId: leId }))
        );
        setLoading(false);

        const firstError = results.find(r => !r.success);
        if (firstError) { alert(firstError.error); return; }

        setOpen(false);
        setEmail("");
        setSelectedLEs([]);
    }

    const toggleLE = (id: string) => {
        if (selectedLEs.includes(id)) {
            setSelectedLEs(selectedLEs.filter(x => x !== id));
        } else {
            setSelectedLEs([...selectedLEs, id]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Invite Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Invite to Team</DialogTitle>
                    <DialogDescription>
                        Give a user access to the Organization or specific Legal Entities.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 py-4">

                    {/* Email */}
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                            placeholder="colleague@company.com"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Permission Level */}
                    <div className="space-y-2">
                        <Label>Permission Level</Label>
                        <Select value={permLevel} onValueChange={setPermLevel}>
                            <SelectTrigger className="bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                {PERM_LEVELS.map(p => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            {isOrgLevel ?
                                "Grants full administrative control over the Organization, Users, and Billing. Does not grant automatic data access to LEs." :
                                "Grants access to specific Legal Entities only."}
                        </p>
                    </div>

                    {/* LE Multi-Select (Only for LE Roles) */}
                    {isLeLevel && (
                        <div className="space-y-2">
                            <Label>Select Legal Entities</Label>
                            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={comboboxOpen}
                                        className="w-full justify-between h-auto min-h-[40px]"
                                    >
                                        {selectedLEs.length > 0
                                            ? `${selectedLEs.length} selected`
                                            : "Select entities..."}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[450px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search legal entities..." />
                                        <CommandList>
                                            <CommandEmpty>No entity found.</CommandEmpty>
                                            <CommandGroup>
                                                {leOptions.map((le) => (
                                                    <CommandItem
                                                        key={le.id}
                                                        value={le.name}
                                                        onSelect={() => toggleLE(le.id)}
                                                    >
                                                        <div className={cn(
                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                            selectedLEs.includes(le.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                        )}>
                                                            <Check className={cn("h-4 w-4")} />
                                                        </div>
                                                        {le.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Selected Chips */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedLEs.map(id => {
                                    const le = leOptions.find(opt => opt.id === id);
                                    return (
                                        <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1">
                                            {le?.name}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 ml-1 hover:bg-slate-200 rounded-full"
                                                onClick={() => toggleLE(id)}
                                                type="button"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading || (isLeLevel && selectedLEs.length === 0)}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Send Invitation{selectedLEs.length > 1 ? 's' : ''}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
