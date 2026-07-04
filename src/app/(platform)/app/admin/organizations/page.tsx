"use client";

import { useState, useEffect, useRef } from "react";
import { getOrganizations, createOrganization, updateOrganization, checkOrgDeletable, deleteOrganization } from "@/actions/org";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Loader2, Plus, Building2, Users, Search, Trash2, AlertTriangle, Ban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

import { useSearchParams } from "next/navigation";

// ── Inline-editable cell ─────────────────────────────────────────────────────

function InlineEditCell({
    value,
    orgId,
    field,
    placeholder,
    onSaved,
    className = "",
}: {
    value: string | null | undefined;
    orgId: string;
    field: "name" | "shortCode" | "domain";
    placeholder?: string;
    onSaved: () => void;
    className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(value ?? "");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const cancelledRef = useRef(false);

    const startEdit = () => {
        cancelledRef.current = false;
        setEditVal(value ?? "");
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commit = async () => {
        // If Escape was pressed, don't save on the subsequent blur
        if (cancelledRef.current) return;

        const trimmed = editVal.trim();
        // No-op if unchanged
        if (trimmed === (value ?? "")) {
            setEditing(false);
            return;
        }
        // Name cannot be empty
        if (field === "name" && !trimmed) {
            toast.error("Name cannot be empty");
            // Revert
            setEditVal(value ?? "");
            setEditing(false);
            return;
        }

        setSaving(true);
        const payload: Record<string, string | null> = {};
        payload[field] = trimmed || null;

        const res = await updateOrganization(orgId, payload);
        setSaving(false);
        if (res.success) {
            toast.success(`${field === "shortCode" ? "Short code" : field.charAt(0).toUpperCase() + field.slice(1)} updated`);
            setEditing(false);
            onSaved();
        } else {
            toast.error(res.error || "Update failed");
            setEditing(false);
        }
    };

    const cancel = () => {
        cancelledRef.current = true;
        setEditing(false);
        setEditVal(value ?? "");
    };

    if (editing) {
        return (
            <Input
                ref={inputRef}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { e.currentTarget.blur(); }
                    if (e.key === "Escape") { cancel(); }
                }}
                className={`h-7 text-sm w-full min-w-[80px] ${saving ? "opacity-50" : ""}`}
                disabled={saving}
                placeholder={placeholder}
            />
        );
    }

    return (
        <span
            onClick={startEdit}
            title="Click to edit"
            className={`cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 py-0.5 transition-colors ${className}`}
        >
            {value || <span className="text-slate-300 italic">{placeholder || "—"}</span>}
        </span>
    );
}

// ── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteOrgButton({ orgId, orgName, orgCount, onDeleted }: {
    orgId: string;
    orgName: string;
    orgCount: Record<string, number>;
    onDeleted: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [checkResult, setCheckResult] = useState<{ deletable: boolean; error?: string; blockers?: string[] } | null>(null);

    // Compute whether the org has any dependencies from the pre-fetched counts
    const totalDeps = Object.values(orgCount).reduce((sum, n) => sum + n, 0);
    const hasDeps = totalDeps > 0;

    // Build a human-readable tooltip summarising why deletion is blocked
    const depSummary = hasDeps
        ? Object.entries(orgCount)
            .filter(([, n]) => n > 0)
            .map(([key, n]) => {
                const labels: Record<string, string> = {
                    memberships: "member",
                    ownedLEs: "owned LE",
                    engagements: "engagement",
                    questionnaires: "questionnaire",
                    ownedQuestionnaires: "owned questionnaire",
                    customFieldDefinitions: "custom field",
                    fiSchemas: "schema",
                    invitations: "invitation",
                    ownedClaims: "owned claim",
                    claims: "subject claim",
                    referencedInClaims: "referenced claim",
                    visibilityGrants: "visibility grant",
                };
                const label = labels[key] || key;
                return `${n} ${label}${n !== 1 ? "s" : ""}`;
            })
            .join(", ")
        : undefined;

    const handleOpen = async () => {
        setOpen(true);
        setChecking(true);
        setCheckResult(null);
        const res = await checkOrgDeletable(orgId);
        setCheckResult({ deletable: res.deletable, error: res.error, blockers: res.blockers });
        setChecking(false);
    };

    const handleConfirmDelete = async () => {
        setDeleting(true);
        const res = await deleteOrganization(orgId);
        setDeleting(false);
        if (res.success) {
            toast.success("Organization deleted");
            setOpen(false);
            onDeleted();
        } else {
            toast.error(res.error || "Delete failed");
        }
    };

    const descriptionContent = (
        <div className="space-y-4">
            <div>{orgName}</div>
            {checking ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for related data…
                </div>
            ) : checkResult && !checkResult.deletable ? (
                <div className="py-2 space-y-2">
                    <p className="text-sm text-red-600 font-medium">{checkResult.error}</p>
                    {checkResult.blockers && checkResult.blockers.length > 0 && (
                        <ul className="text-xs text-slate-500 list-disc list-inside space-y-0.5">
                            {checkResult.blockers.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                    )}
                    <p className="text-xs text-slate-500">Remove all related data before this organization can be deleted.</p>
                </div>
            ) : checkResult && checkResult.deletable ? (
                <div className="py-2 space-y-2">
                    <p className="text-sm text-slate-700">This organization has no related data and can be safely deleted.</p>
                    <p className="text-xs text-slate-500 font-medium">This action cannot be undone.</p>
                </div>
            ) : null}
        </div>
    );

    return (
        <>
            <span
                title={hasDeps ? `Cannot delete: ${depSummary}` : "Delete organization"}
                className="inline-flex"
            >
                <Button
                    variant="ghost"
                    size="sm"
                    className={
                        hasDeps
                            ? "text-slate-300 cursor-not-allowed pointer-events-none h-8 w-8 p-0"
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                    }
                    onClick={hasDeps ? undefined : handleOpen}
                    tabIndex={hasDeps ? -1 : undefined}
                    aria-disabled={hasDeps}
                >
                    {hasDeps
                        ? <Ban className="h-3.5 w-3.5" />
                        : <Trash2 className="h-3.5 w-3.5" />
                    }
                </Button>
            </span>
            <ConfirmDeleteDialog
                open={open}
                onOpenChange={setOpen}
                title="Delete Organization"
                description={descriptionContent}
                isLoading={deleting || checking}
                confirmDisabled={!checkResult?.deletable}
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

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

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<"ALL" | "CLIENT" | "SUPPLIER">("ALL");

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

        // SUPPLIER auto-tag is enforced server-side for FI / LAW_FIRM / OTHER;
        // pass the user's selection as-is.
        const validTypes = types as ("CLIENT" | "FI" | "SYSTEM" | "LAW_FIRM" | "SUPPLIER" | "OTHER")[];
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

    const filteredOrgs = orgs.filter((org: any) => {
        if (searchQuery && !org.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (roleFilter === "CLIENT" && !org.types.includes("CLIENT")) return false;
        if (roleFilter === "SUPPLIER" && !org.types.some((t: string) => ["FI", "LAW_FIRM", "SUPPLIER"].includes(t))) return false;
        return true;
    });

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
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Specialist legal service provider</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    id="chk-other"
                                                    checked={types.includes("OTHER")}
                                                    onChange={() => toggleType("OTHER")}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="grid gap-0.5 pointer-events-none">
                                                    <Label htmlFor="chk-other" className="cursor-pointer pointer-events-auto">Other Supplier</Label>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">e.g. Risk consultant, advisor, auditor</p>
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

            <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search organizations..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Roles</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                        <SelectItem value="SUPPLIER">Supplier (FI / Law Firm / Other)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-[100px]">Short Code</TableHead>
                                <TableHead className="w-[160px]">Domain</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead className="w-[80px]">Members</TableHead>
                                <TableHead className="text-right w-[140px]">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin inline-block" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrgs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No organizations found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrgs.map((org: any) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <InlineEditCell
                                                value={org.name}
                                                orgId={org.id}
                                                field="name"
                                                placeholder="Org name"
                                                onSaved={loadData}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <InlineEditCell
                                            value={org.shortCode}
                                            orgId={org.id}
                                            field="shortCode"
                                            placeholder="Code"
                                            onSaved={loadData}
                                            className="font-mono text-xs"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <InlineEditCell
                                            value={org.domain}
                                            orgId={org.id}
                                            field="domain"
                                            placeholder="domain.com"
                                            onSaved={loadData}
                                            className="text-xs"
                                        />
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
                                            {org._count?.memberships ?? 0}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link href={`/app/admin/organizations/${org.id}`}>
                                                <Button variant="ghost" size="sm">Manage</Button>
                                            </Link>
                                            <DeleteOrgButton
                                                orgId={org.id}
                                                orgName={org.name}
                                                orgCount={org._count ?? {}}
                                                onDeleted={loadData}
                                            />
                                        </div>
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
