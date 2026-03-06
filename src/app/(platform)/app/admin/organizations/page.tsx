"use client";

import { useState, useEffect } from "react";
import { getOrganizations, createOrganization } from "@/actions/org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Loader2, Plus, Building2, Users } from "lucide-react";

import { useSearchParams } from "next/navigation";

export default function OrganizationsPage() {
    const searchParams = useSearchParams();
    const filterType = searchParams.get("type");

    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [types, setTypes] = useState<string[]>(filterType ? [filterType] : ["CLIENT"]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadData();
    }, [filterType]);

    async function loadData() {
        setLoading(true);
        const data = await getOrganizations(filterType || undefined);
        setOrgs(data);
        setLoading(false);
    }

    async function handleCreate() {
        if (!name || types.length === 0) return;
        setCreating(true);

        // Logic: If FI or LAW_FIRM is selected, ensure SUPPLIER is also added for categorisation
        const finalTypes = [...types];
        if ((finalTypes.includes("FI") || finalTypes.includes("LAW_FIRM")) && !finalTypes.includes("SUPPLIER")) {
            finalTypes.push("SUPPLIER");
        }

        const validTypes = finalTypes as ("CLIENT" | "FI" | "SYSTEM" | "LAW_FIRM" | "SUPPLIER")[];
        const res = await createOrganization(name, validTypes);

        setCreating(false);
        if (res.success) {
            setOpen(false);
            setName("");
            loadData();
        } else {
            alert("Error: " + res.error);
        }
    }

    function toggleType(t: string) {
        if (types.includes(t)) {
            setTypes(types.filter((x: any) => x !== t));
        } else {
            setTypes([...types, t]);
        }
    }

    const pageTitle = filterType === "CLIENT" ? "Client Management" :
        filterType === "FI" ? "Financial Institution Management" :
            "Organization Management";
    const buttonText = filterType === "CLIENT" ? "New Client" :
        filterType === "FI" ? "New FI" :
            "New Organization";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            {buttonText}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Organization</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Organization Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Legal LLP" />
                            </div>
                            <div className="space-y-2">
                                <Label>Roles (Multi-select)</Label>
                                <div className="flex flex-col gap-3 p-3 border rounded-md bg-slate-50/50">
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            id="chk-client"
                                            checked={types.includes("CLIENT")}
                                            onChange={() => toggleType("CLIENT")}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <div className="grid gap-0.5 pointer-events-none">
                                            <Label htmlFor="chk-client" className="cursor-pointer pointer-events-auto">Client (Asset Manager / Corporate)</Label>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Has work done FOR them</p>
                                        </div>
                                    </div>

                                    <div className="mt-2 pt-3 border-t">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Supplier Roles</p>
                                        <div className="space-y-3">
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    id="chk-fi"
                                                    checked={types.includes("FI")}
                                                    onChange={() => toggleType("FI")}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="grid gap-0.5 pointer-events-none">
                                                    <Label htmlFor="chk-fi" className="cursor-pointer pointer-events-auto">Financial Institution (FI)</Label>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Performs due diligence on clients</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    id="chk-law"
                                                    checked={types.includes("LAW_FIRM")}
                                                    onChange={() => toggleType("LAW_FIRM")}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="grid gap-0.5 pointer-events-none">
                                                    <Label htmlFor="chk-law" className="cursor-pointer pointer-events-auto">Law Firm</Label>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Specialist service provider</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleCreate} disabled={creating} className="w-full">
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Organization"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin inline-block" />
                                    </TableCell>
                                </TableRow>
                            ) : orgs.map((org: any) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                            {org.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            {org.types.map((t: string) => (
                                                <Badge key={t} variant="outline">{t}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Users className="w-3 h-3" />
                                            {org._count.members}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/app/admin/organizations/${org.id}`}>
                                            <Button variant="ghost" size="sm">Manage</Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
