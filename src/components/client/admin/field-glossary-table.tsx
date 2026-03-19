"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
    VisibilityState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Settings, HelpCircle, Check, X, Loader2, MoreVertical, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { FieldDetailSheet } from "./field-detail-sheet";
import { FieldCreateSheet } from "./field-create-sheet";
import { updateFieldDescription } from "@/actions/master-data-ai";
import { updateMasterField } from "@/actions/master-data-governance";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface FieldGlossaryTableProps {
    initialFields: any[];
}

export function FieldGlossaryTable({ initialFields }: FieldGlossaryTableProps) {
    const router = useRouter();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    
    // External filter states
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterDomain, setFilterDomain] = useState<string>("all");
    const [filterDataType, setFilterDataType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const [selectedField, setSelectedField] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const data = useMemo(() => [...initialFields].filter((f: any) => {
        const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
            (f.category || "").toLowerCase().includes(search.toLowerCase()) ||
            f.fieldNo.toString() === search;

        const matchesCategory = filterCategory === "all" || (f.category || "General") === filterCategory;
        const matchesDomain = filterDomain === "all" || (f.domain && f.domain.includes(filterDomain)) || ((!f.domain || f.domain.length === 0) && filterDomain === "None");
        const matchesDataType = filterDataType === "all" || f.appDataType === filterDataType;
        const matchesStatus = filterStatus === "all" || 
            (filterStatus === "active" && f.isActive) || 
            (filterStatus === "inactive" && !f.isActive);

        return matchesSearch && matchesCategory && matchesDomain && matchesDataType && matchesStatus;
    }), [initialFields, search, filterCategory, filterDomain, filterDataType, filterStatus]);

    const uniqueCategories = Array.from(new Set(initialFields.map(f => f.category || "General"))).sort();
    const uniqueDomains = Array.from(new Set(initialFields.flatMap(f => f.domain && f.domain.length > 0 ? f.domain : ["None"]))).sort();
    const uniqueDataTypes = Array.from(new Set(initialFields.map(f => f.appDataType))).sort();

    const clearFilters = () => {
        setFilterCategory("all");
        setFilterDomain("all");
        setFilterDataType("all");
        setFilterStatus("all");
        setSearch("");
    };

    const hasActiveFilters = filterCategory !== "all" || filterDomain !== "all" || filterDataType !== "all" || filterStatus !== "all" || search !== "";

    // Columns Definition
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "fieldNo",
            header: "No.",
            cell: ({ row }) => <div className="font-medium text-slate-400 font-mono text-xs">{row.getValue("fieldNo")}</div>,
            enableHiding: false,
        },
        {
            accessorKey: "fieldName",
            header: "Field Name & Description",
            cell: ({ row }) => <FieldNameCell row={row} router={router} />,
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => <EditableTextCell row={row} fieldKey="category" fallback="General" router={router} />,
        },
        {
            accessorKey: "domain",
            header: () => (
                <div className="flex items-center justify-between gap-1">
                    <span>Domain</span>
                    <Dialog>
                        <DialogTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 cursor-pointer" />
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>About Domains</DialogTitle>
                                <DialogDescription asChild>
                                    <div className="pt-3 space-y-3 font-normal text-slate-600 dark:text-slate-300 text-sm">
                                        <p>A <strong>Domain</strong> groups data points by context.</p>
                                        <p>A field can hold multiple tags (e.g. <em>"Onboarding"</em>).</p>
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                        </DialogContent>
                    </Dialog>
                </div>
            ),
            cell: ({ row }) => <EditableTagsCell row={row} fieldKey="domain" router={router} />,
        },
        {
            accessorKey: "appDataType",
            header: "Data Type",
            cell: ({ row }) => <EditableSelectCell row={row} fieldKey="appDataType" options={["TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON"]} router={router} />,
        },
        {
            id: "sampleContent",
            header: "Sample Content",
            cell: () => <span className="text-[11px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded">Data View Pending...</span>,
        },
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => <EditableStatusCell row={row} router={router} />,
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => {
                        setSelectedField(row.original);
                        setIsEditDialogOpen(true);
                    }}>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            ),
        }
    ], [router]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnVisibility,
        }
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col xl:flex-row gap-3 mb-4 xl:items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            className="pl-9 w-[200px] bg-white h-9 text-sm"
                            placeholder="Search setup..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[125px] h-9 bg-white text-xs whitespace-nowrap overflow-hidden">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent><SelectItem value="all">All Categories</SelectItem>{uniqueCategories.map(cat => <SelectItem key={cat as string} value={cat as string}>{cat as string}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDomain} onValueChange={setFilterDomain}>
                        <SelectTrigger className="w-[125px] h-9 bg-white text-xs">
                            <SelectValue placeholder="Domain" />
                        </SelectTrigger>
                        <SelectContent><SelectItem value="all">All Domains</SelectItem>{uniqueDomains.map(dom => <SelectItem key={dom as string} value={dom as string}>{dom as string}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDataType} onValueChange={setFilterDataType}>
                        <SelectTrigger className="w-[120px] h-9 bg-white text-xs">
                            <SelectValue placeholder="Data Type" />
                        </SelectTrigger>
                        <SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueDataTypes.map(type => <SelectItem key={type as string} value={type as string}>{type as string}</SelectItem>)}</SelectContent>
                    </Select>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-slate-500 hover:text-slate-900" onClick={clearFilters}>
                            <X className="h-4 w-4 mr-1" /> Clear
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-2 xl:mt-0 justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm text-sm">
                                <SlidersHorizontal className="h-4 w-4" /> Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            {table.getAllColumns().filter(col => col.getCanHide()).map(column => (
                                <DropdownMenuCheckboxItem 
                                    key={column.id} 
                                    className="capitalize" 
                                    checked={column.getIsVisible()} 
                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                >
                                    {column.id.replace(/([A-Z])/g, ' $1').trim()}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" className="h-9 text-sm shadow-sm hidden sm:flex">Export CSV</Button>
                    <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">Add Field</Button>
                </div>
            </div>

            <div className="border rounded-lg bg-white dark:bg-slate-950 overflow-x-auto shadow-sm">
                <Table className="min-w-max">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-slate-50">
                                {headerGroup.headers.map((header) => {
                                    const isSortable = !!(header.column.columnDef as any).accessorKey;
                                    return (
                                        <TableHead 
                                            key={header.id} 
                                            className={isSortable ? "cursor-pointer select-none hover:text-indigo-600" : ""}
                                            onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: ' ↑',
                                                desc: ' ↓',
                                            }[header.column.getIsSorted() as string] ?? null}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="align-top py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                                    No results. Wait, are you spelling it correctly?
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedField && <FieldDetailSheet field={selectedField} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />}
            {isCreateDialogOpen && <FieldCreateSheet open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />}
        </div>
    );
}

// --- Custom Editable Cell Components ---

function FieldNameCell({ row, router }: { row: any, router: any }) {
    const field = row.original;
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(field.fieldName);

    const [isNotesEditing, setIsNotesEditing] = useState(false);
    const [notesVal, setNotesVal] = useState(field.notes || "");
    const [saving, setSaving] = useState(false);

    const handleSaveName = async () => {
        setIsEditing(false);
        if (val !== field.fieldName && val.trim()) {
            const res = await updateMasterField(field.fieldNo, { fieldName: val });
            if(res.success) toast.success("Field renamed");
            else { toast.error("Failed to rename"); setVal(field.fieldName); }
        } else { setVal(field.fieldName); }
    };

    const handleSaveNotes = async () => {
        setSaving(true);
        const res = await updateFieldDescription(field.fieldNo, notesVal);
        setSaving(false);
        setIsNotesEditing(false);
        if(res.success) {
            toast.success("Notes updated");
            router.refresh();
        } else {
            toast.error("Failed to save notes");
            setNotesVal(field.notes || "");
        }
    };

    return (
        <div className="flex flex-col max-w-[400px] min-w-[200px]">
            {isEditing ? (
                <Input autoFocus value={val} onChange={(e)=>setVal(e.target.value)} onBlur={handleSaveName} onKeyDown={(e) => { if(e.key === 'Enter') handleSaveName(); if(e.key === 'Escape') { setIsEditing(false); setVal(field.fieldName); } }} className="h-7 text-sm font-semibold"/>
            ) : (
                <span onDoubleClick={() => setIsEditing(true)} className="font-semibold text-slate-900 group-hover:text-indigo-700 cursor-pointer">{val}</span>
            )}
            
            {isNotesEditing ? (
                <div className="mt-1 space-y-1">
                    <Textarea autoFocus value={notesVal} onChange={(e)=>setNotesVal(e.target.value)} className="min-h-[50px] text-xs resize-none" onKeyDown={(e)=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSaveNotes();} if(e.key==='Escape'){setIsNotesEditing(false); setNotesVal(field.notes||"");}}}/>
                    <div className="flex gap-1"><Button size="sm" onClick={handleSaveNotes} disabled={saving} className="h-5 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700">Save</Button><Button size="sm" variant="ghost" onClick={()=>{setIsNotesEditing(false);setNotesVal(field.notes||"");}} disabled={saving} className="h-5 px-2 text-[10px]">Cancel</Button></div>
                </div>
            ) : (
                <div className="cursor-pointer rounded -ml-1 mt-0.5 p-1 hover:bg-indigo-50 border border-transparent hover:border-indigo-100" onClick={() => setIsNotesEditing(true)}>
                    {field.notes ? <span className="text-[11px] text-slate-500 line-clamp-2 italic">{field.notes}</span> : <span className="text-[10px] text-slate-400 italic">Add description...</span>}
                </div>
            )}
            {field.isMultiValue && <span className="text-[10px] mt-1 uppercase tracking-wider text-blue-600 font-bold">Repeating</span>}
        </div>
    );
}

function EditableTextCell({ row, fieldKey, fallback, router }: { row: any, fieldKey: string, fallback?: string, router: any }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(row.original[fieldKey] || fallback || "");

    const handleSave = async () => {
        setIsEditing(false);
        if (val !== row.original[fieldKey]) {
            const res = await updateMasterField(row.original.fieldNo, { [fieldKey]: val });
            if(res.success) toast.success("Updated successfully");
            else setVal(row.original[fieldKey] || fallback || "");
            router.refresh();
        }
    };

    if (isEditing) {
        return <Input autoFocus value={val} onChange={(e)=>setVal(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if(e.key === 'Enter') handleSave(); if(e.key==='Escape'){ setIsEditing(false); setVal(row.original[fieldKey] || fallback || ""); } }} className="h-7 text-xs"/>;
    }
    return <Badge onDoubleClick={()=>setIsEditing(true)} variant="secondary" className="bg-slate-100 text-slate-700 font-normal cursor-pointer hover:bg-slate-200">{val}</Badge>;
}

function EditableTagsCell({ row, fieldKey, router }: { row: any, fieldKey: string, router: any }) {
    const rawDomain = row.original[fieldKey];
    const initialArr = (rawDomain && rawDomain.length > 0) ? rawDomain : [];
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(initialArr.join(", "));

    const handleSave = async () => {
        setIsEditing(false);
        const newArr = val.split(",").map((s: string) => s.trim()).filter(Boolean);
        // Only update if array is functionally different (crude check but okay for now)
        if (newArr.join() !== initialArr.join()) {
            const res = await updateMasterField(row.original.fieldNo, { [fieldKey]: newArr });
            if(res.success) toast.success("Tags updated");
            else setVal(initialArr.join(", "));
            router.refresh();
        }
    };

    if (isEditing) {
        return <Input autoFocus value={val} onChange={(e)=>setVal(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if(e.key === 'Enter') handleSave(); if(e.key==='Escape'){ setIsEditing(false); setVal(initialArr.join(", ")); } }} className="h-7 text-xs min-w-[120px]"/>;
    }

    if (initialArr.length === 0) return <span onDoubleClick={()=>setIsEditing(true)} className="text-xs text-slate-400 italic cursor-pointer">None</span>;
    return (
        <div className="flex flex-wrap gap-1" onDoubleClick={()=>setIsEditing(true)}>
            {initialArr.map((d: string) => <Badge key={d} variant="secondary" className="bg-purple-50 text-purple-700 font-normal cursor-pointer hover:bg-purple-100">{d}</Badge>)}
        </div>
    );
}

function EditableSelectCell({ row, fieldKey, options, router }: { row: any, fieldKey: string, options: string[], router: any }) {
    const [isEditing, setIsEditing] = useState(false);
    const originalVal = row.original[fieldKey];

    const handleSave = async (newVal: string) => {
        setIsEditing(false);
        if (newVal !== originalVal) {
            const res = await updateMasterField(row.original.fieldNo, { [fieldKey]: newVal });
            if(res.success) toast.success("Type updated");
            router.refresh();
        }
    };

    if (isEditing) {
        return (
            <Select defaultOpen onOpenChange={(open) => !open && setIsEditing(false)} value={originalVal} onValueChange={handleSave}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
        );
    }
    return <span onDoubleClick={()=>setIsEditing(true)} className="font-mono text-xs text-slate-500 cursor-pointer">{originalVal}</span>;
}

function EditableStatusCell({ row, router }: { row: any, router: any }) {
    const isActive = row.original.isActive;
    const [loading, setLoading] = useState(false);

    const toggleStatus = async () => {
        setLoading(true);
        const res = await updateMasterField(row.original.fieldNo, { isActive: !isActive });
        setLoading(false);
        if(res.success) {
            toast.success(isActive ? "Deactivated" : "Activated");
            router.refresh();
        }
    };

    return (
        <div onDoubleClick={toggleStatus} className="cursor-pointer" title="Double click to toggle">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
                isActive ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Active</Badge> 
                         : <Badge variant="outline" className="text-slate-400 hover:bg-slate-50">Inactive</Badge>
            )}
        </div>
    );
}
