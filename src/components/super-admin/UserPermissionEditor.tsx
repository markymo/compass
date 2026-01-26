"use client";

import { useState, useEffect } from "react";
import { assignClientRole, assignLERole, searchClients, addUserToClient } from "@/actions/super-admin-users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, Building2, Briefcase, ChevronDown, ChevronRight, LayoutDashboard, ShieldCheck, DoorOpen } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface UserPermissionEditorProps {
    profile: any; // The tree returned from getUserPermissionsProfile
    userId: string;
}

export function UserPermissionEditor({ profile, userId }: UserPermissionEditorProps) {
    const [data, setData] = useState(profile);
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    // Add Organization State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [orgSearchOpen, setOrgSearchOpen] = useState(false);
    const [orgSearchResults, setOrgSearchResults] = useState<any[]>([]);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);
    const [addRole, setAddRole] = useState("MEMBER");
    const [adding, setAdding] = useState(false);

    async function refresh() {
        // In a real app we'd re-fetch the server action here or rely on parent re-render.
        // For now, we just reload the page to be simple and safe.
        window.location.reload();
    }

    async function updateClientRole(clientId: string, role: string) {
        setLoadingMap(prev => ({ ...prev, [`client-${clientId}`]: true }));
        const res = await assignClientRole({ userId, clientId, role });
        if (res.success) {
            toast.success("Organization Role Updated");
            refresh();
        } else {
            toast.error("Failed to update role");
            setLoadingMap(prev => ({ ...prev, [`client-${clientId}`]: false }));
        }
    }

    async function updateLERole(leId: string, role: string) {
        setLoadingMap(prev => ({ ...prev, [`le-${leId}`]: true }));
        const res = await assignLERole({ userId, leId, role });
        if (res.success) {
            toast.success("Workspace Access Updated");
            // Optimistically update strictly necessary? Reload is safer for consistency.
            refresh();
        } else {
            toast.error("Failed to update workspace access");
            setLoadingMap(prev => ({ ...prev, [`le-${leId}`]: false }));
        }
    }

    async function handleSearch(query: string) {
        if (query.length < 2) return;
        const res = await searchClients(query);
        setOrgSearchResults(res);
    }

    async function handleAddOrg() {
        if (!selectedOrg) return;
        setAdding(true);
        const res = await assignClientRole({ userId, clientId: selectedOrg.id, role: addRole });
        setAdding(false);

        if (res.success) {
            toast.success("Added to Organization");
            setIsAddOpen(false);
            refresh();
        } else {
            toast.error("Failed to add to organization");
        }
    }


    if (!data || !data.user) return <div>User not found</div>;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">{data.user.name || "Unnamed User"}</h2>
                    <p className="text-muted-foreground">{data.user.email}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add to Organization
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add User to Client Organization</DialogTitle>
                            <DialogDescription>
                                Give this user access to a new client environment.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Organization</label>
                                <Popover open={orgSearchOpen} onOpenChange={setOrgSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={orgSearchOpen}
                                            className="w-full justify-between"
                                        >
                                            {selectedOrg ? selectedOrg.name : "Search organization..."}
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[400px]">
                                        <Command shouldFilter={false}>
                                            <CommandInput placeholder="Search clients..." onValueChange={handleSearch} />
                                            <CommandList>
                                                <CommandEmpty>No clients found.</CommandEmpty>
                                                <CommandGroup>
                                                    {orgSearchResults.map((org) => (
                                                        <CommandItem
                                                            key={org.id}
                                                            value={org.id}
                                                            onSelect={() => {
                                                                setSelectedOrg(org);
                                                                setOrgSearchOpen(false);
                                                            }}
                                                        >
                                                            <Building2 className="mr-2 h-4 w-4 opacity-70" />
                                                            {org.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Initial Role</label>
                                <Select value={addRole} onValueChange={setAddRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEMBER">Member (Standard)</SelectItem>
                                        <SelectItem value="ADMIN">Admin (Full Control)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddOrg} disabled={adding || !selectedOrg}>
                                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Membership
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Separator />

            {/* Permissions Tree */}
            <div className="space-y-4">
                {data.memberships.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        This user is not a member of any Client Organizations.
                    </div>
                ) : (
                    data.memberships.map((m: any) => (
                        <OrganizationCard
                            key={m.org.id}
                            membership={m}
                            onUpdateClientRole={updateClientRole}
                            onUpdateLERole={updateLERole}
                            loadingMap={loadingMap}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function OrganizationCard({ membership, onUpdateClientRole, onUpdateLERole, loadingMap }: any) {
    const [isOpen, setIsOpen] = useState(true);
    const org = membership.org;

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </Button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <Building2 className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">{org.name}</CardTitle>
                                    <CardDescription>
                                        {membership.les.length} Workspaces Available
                                    </CardDescription>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                                <ShieldCheck className="h-4 w-4 text-slate-500" />
                                <span className="text-sm font-medium text-slate-600 mr-2">Org Role:</span>
                                <Select
                                    value={membership.role}
                                    onValueChange={(val) => onUpdateClientRole(org.id, val)}
                                    disabled={loadingMap[`client-${org.id}`]}
                                >
                                    <SelectTrigger className="h-8 w-[140px] border-none bg-transparent shadow-none focus:ring-0 font-semibold text-primary">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEMBER">Member</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="NONE" className="text-red-600">Remove Access</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <Separator />
                    <CardContent className="pt-6 pb-6 bg-slate-50/50">
                        <div className="space-y-1 pl-12 pr-4">
                            <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground uppercase mb-2 px-3">
                                <div className="col-span-6">Workspace Name</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-4 text-right">Access Level</div>
                            </div>

                            {membership.les.length === 0 && (
                                <div className="text-sm text-muted-foreground py-2 px-3 italic">
                                    No workspaces found for this organization.
                                </div>
                            )}

                            {membership.les.map((le: any) => (
                                <div key={le.id} className="grid grid-cols-12 items-center px-3 py-2 rounded-md hover:bg-white transition-colors border border-transparent hover:border-slate-200 group">
                                    <div className="col-span-6 flex items-center gap-3">
                                        <Briefcase className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                                        <span className="font-medium text-sm text-slate-700">{le.name}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <Badge variant="outline" className="text-[10px] h-5 rounded-full px-2 font-normal">
                                            {le.status}
                                        </Badge>
                                    </div>
                                    <div className="col-span-4 flex justify-end">
                                        <Select
                                            value={le.role}
                                            onValueChange={(val) => onUpdateLERole(le.id, val)}
                                            disabled={loadingMap[`le-${le.id}`]}
                                        >
                                            <SelectTrigger className={`h-8 w-[180px] text-xs ${le.role !== 'NONE' ? 'bg-white border-slate-200' : 'bg-transparent border-transparent text-muted-foreground'}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">No Direct Access</SelectItem>
                                                <SelectItem value="VIEWER">Viewer (Read Only)</SelectItem>
                                                <SelectItem value="EDITOR">Editor (Can Manage)</SelectItem>
                                                <SelectItem value="MEMBER">Member</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
