"use client";

import { useState } from "react";
import { createClient, createWorkspace, createSupplier, engageSupplier, getAllSuppliers } from "@/actions/ecosystem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Building2,
    PlusCircle,
    ChevronDown,
    ChevronRight,
    Briefcase,
    Globe,
    PlugZap,
    Loader2
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface EcosystemManagerProps {
    tree: any[]; // The hierarchical data
    initialSuppliers: any[]; // Pre-fetched suppliers for dropdowns
}

export function EcosystemManager({ tree, initialSuppliers }: EcosystemManagerProps) {
    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false);

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex gap-4">
                <CreateOrgDialog
                    isOpen={isCreateClientOpen}
                    setIsOpen={setIsCreateClientOpen}
                    type="CLIENT"
                    title="Create New Client"
                    desc="Add a new Client Organization to the ecosystem."
                />
                <CreateOrgDialog
                    isOpen={isCreateSupplierOpen}
                    setIsOpen={setIsCreateSupplierOpen}
                    type="FI"
                    title="Create New Supplier"
                    desc="Add a new Financial Institution / Supplier to the global pool."
                />
            </div>

            <Separator />

            <div className="space-y-4">
                {tree.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        No clients found. Create one to get started.
                    </div>
                ) : (
                    tree.map((client) => (
                        <ClientCard key={client.id} client={client} suppliers={initialSuppliers} />
                    ))
                )}
            </div>
        </div>
    );
}

function CreateOrgDialog({ isOpen, setIsOpen, type, title, desc }: any) {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleCreate() {
        if (!name) return;
        setLoading(true);

        let res;
        if (type === "CLIENT") res = await createClient(name);
        else res = await createSupplier(name);

        setLoading(false);
        if (res.success) {
            toast.success(`${type === "CLIENT" ? "Client" : "Supplier"} Created`);
            setIsOpen(false);
            setName("");
            // Simplest refresh
            window.location.reload();
        } else {
            toast.error("Failed to create organization");
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={type === "CLIENT" ? "default" : "secondary"}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {type === "CLIENT" ? "New Client" : "New Supplier"}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{desc}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label>Organization Name</Label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Acme Corp"
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleCreate} disabled={loading || !name}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ------------------------------------------------------------------
// Level 1: Client Card
// ------------------------------------------------------------------
function ClientCard({ client, suppliers }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAddWorkspaceOpen, setIsAddWorkspaceOpen] = useState(false);

    // Add Workspace State
    const [wsName, setWsName] = useState("");
    const [wsJurisdiction, setWsJurisdiction] = useState("");
    const [wsLoading, setWsLoading] = useState(false);

    async function handleAddWorkspace() {
        if (!wsName || !wsJurisdiction) return;
        setWsLoading(true);
        const res = await createWorkspace({ clientId: client.id, name: wsName, jurisdiction: wsJurisdiction });
        setWsLoading(false);

        if (res.success) {
            toast.success("Workspace Created");
            setIsAddWorkspaceOpen(false);
            setWsName("");
            setWsJurisdiction("");
            window.location.reload();
        } else {
            toast.error("Failed to create workspace");
        }
    }

    return (
        <Card className="border-l-4 border-l-blue-600">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </Button>
                            </CollapsibleTrigger>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Building2 className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle>{client.name}</CardTitle>
                                <CardDescription>{client.workspaces.length} Workspaces</CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Dialog open={isAddWorkspaceOpen} onOpenChange={setIsAddWorkspaceOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Workspace
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Workspace to {client.name}</DialogTitle>
                                        <DialogDescription>Create a new Legal Entity (SPV/Project Co) for this client.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div>
                                            <Label>Workspace Name</Label>
                                            <Input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="e.g. Project Alpha SPV" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label>Jurisdiction</Label>
                                            <Input value={wsJurisdiction} onChange={e => setWsJurisdiction(e.target.value)} placeholder="e.g. UK, Delaware, Singapore" className="mt-1" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleAddWorkspace} disabled={wsLoading || !wsName || !wsJurisdiction}>
                                            {wsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Workspace
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <Separator />
                    <CardContent className="bg-slate-50/50 pt-6">
                        <div className="space-y-3 pl-8">
                            {client.workspaces.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic py-2">No workspaces yet.</div>
                            ) : (
                                client.workspaces.map((ws: any) => (
                                    <WorkspaceItem key={ws.id} workspace={ws} suppliers={suppliers} />
                                ))
                            )}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

// ------------------------------------------------------------------
// Level 2: Workspace Item
// ------------------------------------------------------------------
function WorkspaceItem({ workspace, suppliers }: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEngageOpen, setIsEngageOpen] = useState(false);

    // Engage State
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [engageLoading, setEngageLoading] = useState(false);
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);

    async function handleEngage() {
        if (!selectedSupplierId) return;
        setEngageLoading(true);
        const res = await engageSupplier({ clientLEId: workspace.id, supplierId: selectedSupplierId });
        setEngageLoading(false);

        if (res.success) {
            toast.success("Supplier Engaged");
            setIsEngageOpen(false);
            window.location.reload();
        } else {
            toast.error("Failed to engage supplier");
        }
    }

    const selectedSupplierName = suppliers.find((s: any) => s.id === selectedSupplierId)?.name;

    return (
        <div className="border rounded-md bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6 hover:bg-transparent"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    <div>
                        <div className="font-medium text-sm">{workspace.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Globe className="h-3 w-3" /> {workspace.jurisdiction}
                            <span className="text-slate-300">|</span>
                            {workspace.status}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] font-normal">
                        {workspace.engagements.length} Suppliers
                    </Badge>
                    <Dialog open={isEngageOpen} onOpenChange={setIsEngageOpen}>
                        <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                <PlusCircle className="h-4 w-4 text-indigo-600" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Engage Supplier</DialogTitle>
                                <DialogDescription>Link a Supplier Organization to <strong>{workspace.name}</strong>.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label className="mb-2 block">Select Supplier</Label>
                                <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {selectedSupplierName || "Select supplier..."}
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[350px]">
                                        <Command>
                                            <CommandInput placeholder="Search suppliers..." />
                                            <CommandList>
                                                <CommandEmpty>No suppliers found. Create one first.</CommandEmpty>
                                                <CommandGroup>
                                                    {suppliers.map((s: any) => (
                                                        <CommandItem
                                                            key={s.id}
                                                            value={s.name} // Search by name
                                                            onSelect={() => {
                                                                setSelectedSupplierId(s.id);
                                                                setSupplierSearchOpen(false);
                                                            }}
                                                        >
                                                            <Building2 className="mr-2 h-4 w-4 opacity-70" />
                                                            {s.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleEngage} disabled={engageLoading || !selectedSupplierId}>
                                    {engageLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Engage
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Level 3: Engagements */}
            {isExpanded && (
                <div className="bg-indigo-50/30 border-t p-3 pl-10 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Active Engagements</div>
                    {workspace.engagements.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">No suppliers engaged yet.</div>
                    ) : (
                        workspace.engagements.map((eng: any) => (
                            <div key={eng.id} className="flex items-center justify-between text-sm bg-white border px-3 py-2 rounded-sm">
                                <div className="flex items-center gap-2">
                                    <PlugZap className="h-4 w-4 text-amber-500" />
                                    <span className="font-semibold text-slate-700">{eng.supplierName}</span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] h-5">{eng.status}</Badge>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
