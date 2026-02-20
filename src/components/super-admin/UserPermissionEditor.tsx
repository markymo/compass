"use client";

import { useState, useEffect } from "react";
import { assignClientRole, assignLERole, searchClients, addUserToClient, createClientLEForOrg, updateUserBasicInfo, resetUserPassword, updateDemoActorStatus } from "@/actions/super-admin-users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, Building2, Briefcase, ChevronDown, ChevronRight, LayoutDashboard, ShieldCheck, DoorOpen, Pencil, CheckCircle2, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
    const [addRole, setAddRole] = useState("ORG_MEMBER");
    const [adding, setAdding] = useState(false);

    // Reset Password State
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [resetting, setResetting] = useState(false);

    async function handleToggleDemoActor(checked: boolean) {
        const res = await updateDemoActorStatus(userId, checked);
        if (res.success) {
            setData((prev: any) => ({
                ...prev,
                user: { ...prev.user, isDemoActor: checked }
            }));
            toast.success(checked ? "User marked as Demo Actor" : "User removed from Demo Actors");
        } else {
            toast.error("Failed to update status");
        }
    }

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
            toast.success("Client Legal Entity (LE) Workspace Access Updated");
            // Optimistically update strictly necessary? Reload is safer for consistency.
            refresh();
        } else {
            toast.error("Failed to update Client Legal Entity (LE) Workspace access");
            setLoadingMap(prev => ({ ...prev, [`le-${leId}`]: false }));
        }
    }

    async function handleSearch(query: string) {
        if (query.length < 2) return;
        const res = await searchClients(query);
        setOrgSearchResults(res);
    }

    async function handleResetPassword() {
        if (!newPassword) return;
        setResetting(true);
        const res = await resetUserPassword(userId, newPassword);
        setResetting(false);

        if (res.success) {
            toast.success("Password reset successfully");
            setIsResetOpen(false);
            setNewPassword("");
        } else {
            toast.error("Failed to reset password");
        }
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
            <div className="flex items-start justify-between">
                <div className="flex-1 mr-8">
                    <EditableUserField
                        userId={userId}
                        value={data.user.name || ""}
                        field="name"
                        className="text-xl font-bold text-slate-900"
                        placeholder="Unnamed User"
                    />
                    <div className="text-sm text-muted-foreground mb-2">{data.user.email}</div>

                    <EditableUserField
                        userId={userId}
                        value={data.user.description || ""}
                        field="description"
                        className="text-sm text-slate-600 italic"
                        placeholder="Add a description for this user..."
                        multiline
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center space-x-2 mr-4 bg-amber-50 px-3 py-2 rounded-md border border-amber-100">
                        <Switch
                            id="demo-mode"
                            checked={data.user.isDemoActor || false}
                            onCheckedChange={handleToggleDemoActor}
                        />
                        <Label htmlFor="demo-mode" className="text-sm font-medium text-amber-900 cursor-pointer">
                            Demo Actor
                        </Label>
                    </div>
                    <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive">
                                <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Reset User Password</DialogTitle>
                                <DialogDescription>
                                    Set a new password for this user. They will need to use this new password to log in.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleResetPassword} disabled={resetting || !newPassword}>
                                    {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Reset Password
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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
                                        <PopoverContent className="p-0 w-[400px] bg-white dark:bg-slate-950 z-50 shadow-md border">
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
                                                                <div className="flex items-center gap-2">
                                                                    <Building2 className="mr-2 h-4 w-4 opacity-70" />
                                                                    <span>{org.name}</span>
                                                                    <Badge variant="outline" className="ml-2 text-[10px] h-5">{org.type}</Badge>
                                                                </div>
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
                                            <SelectItem value="ORG_MEMBER">Member (Standard)</SelectItem>
                                            <SelectItem value="ORG_ADMIN">Admin (Full Control)</SelectItem>
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
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newLeName, setNewLeName] = useState("");
    const [creating, setCreating] = useState(false);

    async function handleCreateLE() {
        if (!newLeName.trim()) return;
        setCreating(true);
        // Default jurisdiction to "UK" or empty for now as it's just a quick add
        const res = await createClientLEForOrg({ name: newLeName, jurisdiction: "UK", orgId: org.id });
        setCreating(false);

        if (res.success) {
            toast.success("Client Legal Entity (LE) Workspace Created");
            setIsCreateOpen(false);
            setNewLeName("");
            // Refresh logic - ideally we lift state up or trigger a reload
            window.location.reload();
        } else {
            toast.error("Failed to create workspace");
        }
    }

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <CollapsibleTrigger asChild disabled={org.type !== "CLIENT"}>
                                <Button variant="ghost" size="sm" className={`p-0 h-auto hover:bg-transparent ${org.type !== "CLIENT" ? "opacity-0 cursor-default" : ""}`}>
                                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </Button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    {org.type === "FI" ? (
                                        <Building2 className="h-5 w-5 text-indigo-600" />
                                    ) : (
                                        <Building2 className="h-5 w-5 text-slate-600" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base">{org.name}</CardTitle>
                                        <Badge variant="secondary" className="text-[10px] h-5">{org.type}</Badge>
                                    </div>
                                    <CardDescription>
                                        {org.type === "CLIENT"
                                            ? `${membership.les.length} Client Legal Entity (LE) Workspaces Available`
                                            : "Supplier Organization (No Client Legal Entity (LE) Workspaces)"}
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
                                        <SelectItem value="ORG_MEMBER">Member (Standard)</SelectItem>
                                        <SelectItem value="ORG_ADMIN">Client Admin</SelectItem>
                                        <SelectItem value="NONE" className="text-red-600">Remove Access</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Create LE Button - Allow for CLIENT and FI (Super Admin Flexibilty) */}
                            {["CLIENT", "FI"].includes(org.type) && (
                                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 text-xs border-dashed gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                        // Stop propagation so it doesn't toggle collapse
                                        >
                                            <PlusCircle className="h-3 w-3" />
                                            Create Workspace
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                                        <DialogHeader>
                                            <DialogTitle>Create New Workspace</DialogTitle>
                                            <DialogDescription>
                                                Create a new Legal Entity Workspace for {org.name}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="le-name">Workspace Name</Label>
                                                <Input
                                                    id="le-name"
                                                    value={newLeName}
                                                    onChange={(e) => setNewLeName(e.target.value)}
                                                    placeholder="e.g. Project Alpha SPV"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCreateLE} disabled={creating || !newLeName.trim()}>
                                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Create
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <Separator />
                    <CardContent className="pt-6 pb-6 bg-slate-50/50">
                        <div className="space-y-1 pl-12 pr-4">
                            <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground uppercase mb-2 px-3">
                                <div className="col-span-6">Client Legal Entity (LE) Workspace Name</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-4 text-right">Access Level</div>
                            </div>

                            {membership.les.length === 0 && (
                                <div className="text-sm text-muted-foreground py-2 px-3 italic">
                                    No Client Legal Entity (LE) Workspaces found for this organization.
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
                                    <div className="col-span-4 flex justify-end items-center gap-4">
                                        <div className="col-span-4 flex justify-end items-center gap-4">
                                            <Select
                                                value={["LE_ADMIN", "LE_USER"].includes(le.role) ? le.role : (le.role === "NONE" ? undefined : le.role)}
                                                onValueChange={(val) => onUpdateLERole(le.id, val)}
                                                disabled={loadingMap[`le-${le.id}`]}
                                            >
                                                <SelectTrigger className="h-8 w-[140px]">
                                                    <SelectValue placeholder="No Access" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LE_USER">LE User</SelectItem>
                                                    <SelectItem value="LE_ADMIN">LE Admin</SelectItem>
                                                    <SelectItem value="NONE" className="text-red-600">Remove Access</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
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

function EditableUserField({ userId, value, field, className, placeholder, multiline }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);

    // Reset if prop updates from outside
    useEffect(() => { setCurrentValue(value); }, [value]);

    async function handleSave() {
        if (currentValue === value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        // Optimistic update?
        const res = await updateUserBasicInfo(userId, { [field]: currentValue });
        setIsSaving(false);

        if (res.success) {
            setIsEditing(false);
            toast.success("Updated");
        } else {
            toast.error("Failed to update");
            setCurrentValue(value); // Revert
        }
    }

    if (isEditing) {
        return (
            <div className="relative group mb-1">
                {multiline ? (
                    <textarea
                        className={`w-full p-1 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-slate-200 focus:border-transparent ${className}`}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        onBlur={handleSave}
                        disabled={isSaving}
                        placeholder={placeholder}
                        autoFocus
                        rows={2}
                    />
                ) : (
                    <input
                        className={`w-full p-1 bg-white border border-slate-200 rounded focus:ring-2 focus:ring-slate-200 focus:border-transparent ${className}`}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        onBlur={handleSave}
                        disabled={isSaving}
                        placeholder={placeholder}
                        autoFocus
                    />
                )}
                {isSaving && <Loader2 className="absolute right-2 top-2 h-3 w-3 animate-spin text-slate-400" />}
            </div>
        );
    }

    return (
        <div
            className={`group relative cursor-pointer border border-transparent hover:border-slate-200 rounded p-1 -ml-1 flex items-center gap-2 ${className}`}
            onClick={() => setIsEditing(true)}
            title="Click to edit"
        >
            <span className={!currentValue ? "text-slate-400 italic font-light" : ""}>
                {currentValue || placeholder}
            </span>
            <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
