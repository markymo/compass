"use client";
import { cn } from "@/lib/utils";

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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Settings, HelpCircle, Check, X, Loader2, MoreVertical, SlidersHorizontal, ArrowUpDown, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { FieldDetailSheet } from "./field-detail-sheet";
import { FieldCreateSheet } from "./field-create-sheet";
import { updateFieldDescription } from "@/actions/master-data-ai";
import { updateMasterField } from "@/actions/master-data-governance";
import { moveFieldOrder } from "@/actions/master-data-sort";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface FieldGlossaryTableProps {
    initialFields: any[];
}

export function FieldGlossaryTable({ initialFields }: FieldGlossaryTableProps) {
    const router = useRouter();
    const [sorting, setSorting] = useState<SortingState>([{ id: "order", desc: false }]);
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

    // --- Inline Insertion State ---
    const [insertingBelowFieldNo, setInsertingBelowFieldNo] = useState<number | null>(null);
    const [newFieldDraft, setNewFieldDraft] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleInsertBelow = (field: any) => {
        // 1. Sort global data by order to find the next item
        const sorted = [...initialFields].sort((a, b) => (a.order || 0) - (b.order || 0));
        const idx = sorted.findIndex(f => f.fieldNo === field.fieldNo);
        
        let newOrder = (field.order || 0) + 10;
        if (idx !== -1 && idx < sorted.length - 1) {
            const nextField = sorted[idx + 1];
            newOrder = ((field.order || 0) + (nextField.order || 0)) / 2;
        }

        setNewFieldDraft({
            fieldName: "",
            description: "",
            appDataType: "TEXT",
            category: field.category || undefined,
            categoryId: field.categoryId || undefined,
            domain: field.domain || ["Onboarding"],
            order: newOrder
        });
        setInsertingBelowFieldNo(field.fieldNo);
    };

    const handleCreateField = async (draft: any) => {
        if (!draft.fieldName.trim()) {
            toast.error("Field name is required");
            return;
        }
        setIsCreating(true);
        try {
            const { createMasterField } = await import("@/actions/master-data-governance");
            const res = await createMasterField(draft);
            if (res.success) {
                toast.success("Field created successfully");
                setInsertingBelowFieldNo(null);
                setNewFieldDraft(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to create field");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsCreating(false);
        }
    };

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
        setSorting([{ id: "order", desc: false }]);
    };

    const isDefaultSorting = sorting.length === 1 && sorting[0].id === "order" && !sorting[0].desc;
    const hasActiveFilters = filterCategory !== "all" || filterDomain !== "all" || filterDataType !== "all" || filterStatus !== "all" || search !== "" || !isDefaultSorting;

    // Build a lookup for first/last field within each category (for arrow disable logic)
    const categoryBoundaries = useMemo(() => {
        if (!isDefaultSorting) return new Map<number, { isFirst: boolean; isLast: boolean }>();
        const grouped = new Map<string | null, any[]>();
        for (const f of data) {
            const catKey = f.categoryId ?? "__uncategorized__";
            if (!grouped.has(catKey)) grouped.set(catKey, []);
            grouped.get(catKey)!.push(f);
        }
        const result = new Map<number, { isFirst: boolean; isLast: boolean }>();
        for (const fields of grouped.values()) {
            fields.forEach((f: any, i: number) => {
                result.set(f.fieldNo, { isFirst: i === 0, isLast: i === fields.length - 1 });
            });
        }
        return result;
    }, [data, isDefaultSorting]);

    // Columns Definition
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "fieldNo",
            header: "No.",
            size: 50,
            cell: ({ row }) => <div className="font-medium text-slate-400 font-mono text-xs">{row.getValue("fieldNo")}</div>,
            enableHiding: false,
        },
        {
            accessorKey: "fieldName",
            header: "Field Name",
            size: 180,
            cell: ({ row }) => <FieldNameCell key={row.original.fieldNo} row={row} router={router} />,
        },
        {
            accessorKey: "notes",
            header: "Description",
            size: 200,
            cell: ({ row }) => <DescriptionCell key={row.original.fieldNo} row={row} router={router} />,
        },
        {
            accessorKey: "category",
            header: "Category",
            size: 130,
            cell: ({ row }) => <EditableTextCell key={row.original.fieldNo + "_cat"} row={row} fieldKey="category" fallback="General" router={router} />,
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
            cell: ({ row }) => <EditableTagsCell key={row.original.fieldNo} row={row} fieldKey="domain" router={router} />,
        },
        {
            accessorKey: "appDataType",
            header: "Data Type",
            size: 80,
            cell: ({ row }) => <EditableSelectCell key={row.original.fieldNo} row={row} fieldKey="appDataType" options={["TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON"]} router={router} />,
        },
        {
            id: "sources",
            header: "Source",
            size: 100,
            cell: ({ row }) => {
                const mappings = row.original.sourceMappings || [];
                if (mappings.length === 0) return <span className="text-[10px] text-slate-400">Manual</span>;

                const uniqueSources = Array.from(new Set(mappings.map((m: any) => m.sourceType)));

                return (
                    <div className="flex flex-wrap gap-1">
                        {uniqueSources.map((source: any) => {
                            let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
                            let label = source;

                            if (source === "GLEIF") {
                                colorClass = "bg-blue-50 text-blue-700 border-blue-200";
                            } else if (source === "COMPANIES_HOUSE") {
                                colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]";
                                label = "Companies House";
                            } else if (source === "NATIONAL_REGISTRY") {
                                colorClass = "bg-amber-50 text-amber-700 border-amber-200";
                                label = "Registry";
                            } else if (source === "AI_EXTRACTION") {
                                colorClass = "bg-purple-50 text-purple-700 border-purple-200";
                                label = "AI";
                            }

                            return (
                                <Badge
                                    key={source}
                                    variant="outline"
                                    className={cn("px-1.5 py-0 h-4 text-[10px] font-medium whitespace-nowrap", colorClass)}
                                >
                                    {label}
                                </Badge>
                            );
                        })}
                    </div>
                );
            }
        },
        {
            id: "sampleContent",
            header: "Sample Content",
            size: 120,
            cell: () => <span className="text-[11px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded">Data View Pending...</span>,
        },
        {
            accessorKey: "order",
            header: "Order",
            size: 90,
            cell: ({ row }) => <OrderCell key={row.original.fieldNo + "_order"} row={row} router={router} isOrderSorted={isDefaultSorting} categoryBoundaries={categoryBoundaries} />,
        },
        {
            accessorKey: "isActive",
            header: "Status",
            size: 70,
            cell: ({ row }) => <EditableStatusCell key={row.original.fieldNo} row={row} router={router} />,
        },
        {
            id: "actions",
            size: 40,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setSelectedField(row.original);
                                setIsEditDialogOpen(true);
                            }}>
                                <Settings className="mr-2 h-4 w-4 text-slate-400" />
                                Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleInsertBelow(row.original)}>
                                <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                                Insert Below
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        }
    ], [router, isDefaultSorting, categoryBoundaries]);

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
                    <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm text-sm border-slate-200 text-slate-600 hover:text-indigo-600" onClick={() => setSorting([{ id: "order", desc: false }])}>
                        <ArrowUpDown className="h-4 w-4" /> Reset Sort
                    </Button>
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

            <div className="border rounded-lg bg-white dark:bg-slate-950 shadow-sm">
                <Table className="w-full table-fixed">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-slate-50">
                                {headerGroup.headers.map((header) => {
                                    const isSortable = !!(header.column.columnDef as any).accessorKey;
                                    return (
                                        <TableHead 
                                            key={header.id} 
                                            style={{ width: header.getSize() }}
                                            className={`overflow-hidden ${isSortable ? "cursor-pointer select-none hover:text-indigo-600" : ""}`}
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
                                <React.Fragment key={row.id}>
                                    <TableRow className="hover:bg-indigo-50/30 transition-colors group">
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="align-top py-1.5 px-3 overflow-hidden text-ellipsis">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {insertingBelowFieldNo === row.original.fieldNo && (
                                        <NewFieldInlineRow 
                                            draft={newFieldDraft} 
                                            isCreating={isCreating}
                                            onCancel={() => {
                                                setInsertingBelowFieldNo(null);
                                                setNewFieldDraft(null);
                                            }}
                                            onSave={handleCreateField}
                                        />
                                    )}
                                </React.Fragment>
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

    useEffect(() => {
        if (!isEditing) setVal(field.fieldName);
    }, [field.fieldName, isEditing]);

    const handleSaveName = async () => {
        setIsEditing(false);
        if (val !== field.fieldName && val.trim()) {
            const res = await updateMasterField(field.fieldNo, { fieldName: val });
            if(res.success) toast.success("Field renamed");
            else { toast.error("Failed to rename"); setVal(field.fieldName); }
        } else { setVal(field.fieldName); }
    };

    return (
        <div className="flex flex-col">
            {isEditing ? (
                <Input autoFocus value={val} onChange={(e)=>setVal(e.target.value)} onBlur={handleSaveName} onKeyDown={(e) => { if(e.key === 'Enter') handleSaveName(); if(e.key === 'Escape') { setIsEditing(false); setVal(field.fieldName); } }} className="h-7 text-sm font-semibold"/>
            ) : (
                <span onClick={() => setIsEditing(true)} className="font-semibold text-slate-900 group-hover:text-indigo-700 cursor-pointer truncate" title={val}>{val}</span>
            )}
            {field.isMultiValue && <span className="text-[9px] mt-0.5 uppercase tracking-wider text-blue-600 font-bold">Repeating</span>}
        </div>
    );
}

function DescriptionCell({ row, router }: { row: any, router: any }) {
    const field = row.original;
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(field.notes || "");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isEditing) setVal(field.notes || "");
    }, [field.notes, isEditing]);

    const handleSave = async () => {
        if (val === field.notes) {
            setIsEditing(false);
            return;
        }
        setSaving(true);
        const res = await updateFieldDescription(field.fieldNo, val);
        setSaving(false);
        setIsEditing(false);
        if(res.success) {
            toast.success("Description updated");
            router.refresh();
        } else {
            toast.error("Failed to save description");
            setVal(field.notes || "");
        }
    };

    if (isEditing) {
        return (
            <div className="space-y-1">
                <Textarea 
                    autoFocus 
                    value={val} 
                    onChange={(e)=>setVal(e.target.value)} 
                    onBlur={handleSave}
                    className="min-h-[60px] text-xs resize-none" 
                    onKeyDown={(e)=>{
                        if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSave();} 
                        if(e.key==='Escape'){setIsEditing(false); setVal(field.notes||"");}
                    }}
                />
            </div>
        );
    }

    return (
        <div className="cursor-pointer group" onClick={() => setIsEditing(true)}>
            {field.notes ? (
                <span className="text-[11px] text-slate-500 line-clamp-1 italic group-hover:text-indigo-600 leading-tight block">
                    {field.notes}
                </span>
            ) : (
                <span className="text-[10px] text-slate-400 italic">Add description...</span>
            )}
        </div>
    );
}

function EditableTextCell({ row, fieldKey, fallback, router, type = "text" }: { row: any, fieldKey: string, fallback?: string, router: any, type?: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(row.original[fieldKey]?.toString() || fallback || "");

    useEffect(() => {
        if (!isEditing) setVal(row.original[fieldKey]?.toString() || fallback || "");
    }, [row.original, fieldKey, isEditing, fallback]);

    const handleSave = async () => {
        setIsEditing(false);
        const processedVal = type === "number" ? parseFloat(val) : val;
        if (processedVal !== row.original[fieldKey]) {
            const res = await updateMasterField(row.original.fieldNo, { [fieldKey]: processedVal });
            if(res.success) toast.success("Updated successfully");
            else setVal(row.original[fieldKey]?.toString() || fallback || "");
            router.refresh();
        }
    };

    if (isEditing) {
        return <Input autoFocus type={type} value={val} onChange={(e)=>setVal(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if(e.key === 'Enter') handleSave(); if(e.key==='Escape'){ setIsEditing(false); setVal(row.original[fieldKey]?.toString() || fallback || ""); } }} className="h-7 text-xs"/>;
    }
    return <Badge onClick={()=>setIsEditing(true)} variant="secondary" className="bg-slate-100 text-slate-700 font-normal cursor-pointer hover:bg-slate-200">{val}</Badge>;
}

function EditableTagsCell({ row, fieldKey, router }: { row: any, fieldKey: string, router: any }) {
    const rawDomain = row.original[fieldKey];
    const initialArr = (rawDomain && rawDomain.length > 0) ? rawDomain : [];
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(initialArr.join(", "));

    useEffect(() => {
        if (!isEditing) setVal(initialArr.join(", "));
    }, [initialArr, isEditing]);

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

    if (initialArr.length === 0) return <span onClick={()=>setIsEditing(true)} className="text-xs text-slate-400 italic cursor-pointer">None</span>;
    return (
        <div className="flex flex-wrap gap-1" onClick={()=>setIsEditing(true)}>
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
    return <span onClick={()=>setIsEditing(true)} className="font-mono text-xs text-slate-500 cursor-pointer">{originalVal}</span>;
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
        <div onClick={toggleStatus} className="cursor-pointer" title="Click to toggle">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
                isActive ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Active</Badge> 
                         : <Badge variant="outline" className="text-slate-400 hover:bg-slate-50">Inactive</Badge>
            )}
        </div>
    );
}

// --- New Field Inline Row Component ---

function NewFieldInlineRow({ draft, isCreating, onCancel, onSave }: { draft: any, isCreating: boolean, onCancel: () => void, onSave: (draft: any) => void }) {
    const [val, setVal] = useState(draft);

    return (
        <TableRow className="bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40 transition-colors animate-in fade-in slide-in-from-top-1 duration-200">
            <TableCell className="py-2 px-3">
                <div className="font-medium text-slate-300 font-mono text-xs italic">NEW</div>
            </TableCell>
            <TableCell className="py-2 px-3">
                <Input 
                    autoFocus 
                    placeholder="Field Name..." 
                    value={val.fieldName} 
                    onChange={(e) => setVal({ ...val, fieldName: e.target.value })}
                    className="h-8 text-sm font-semibold border-emerald-200 focus-visible:ring-emerald-500 bg-white"
                />
            </TableCell>
            <TableCell className="py-2 px-3">
                <Input 
                    placeholder="Description (Optional)..." 
                    value={val.description} 
                    onChange={(e) => setVal({ ...val, description: e.target.value })}
                    className="h-8 text-[11px] border-emerald-100 focus-visible:ring-emerald-500 bg-white"
                />
            </TableCell>
            <TableCell className="py-2 px-3">
                <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 h-5 text-[10px] font-normal italic">
                    {val.category || "General"}
                </Badge>
            </TableCell>
            <TableCell className="py-2 px-3">
                 <div className="flex flex-wrap gap-1">
                    {val.domain.map((d: string) => (
                        <Badge key={d} variant="secondary" className="bg-purple-50 text-purple-700 h-5 text-[9px] font-normal border-purple-100">
                            {d}
                        </Badge>
                    ))}
                </div>
            </TableCell>
            <TableCell className="py-2 px-3">
                <div className="font-mono text-[10px] text-slate-400">{val.appDataType}</div>
            </TableCell>
            <TableCell className="py-2 px-3">
                <span className="text-[10px] text-slate-400 italic">None</span>
            </TableCell>
            <TableCell className="py-2 px-3">
                <span className="text-[10px] text-slate-400 italic">...</span>
            </TableCell>
            <TableCell className="py-2 px-3">
                <div className="font-mono text-[10px] text-slate-400">{val.order.toFixed(1)}</div>
            </TableCell>
            <TableCell className="py-2 px-3">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 h-5 text-[9px] uppercase tracking-wider">Draft</Badge>
            </TableCell>
            <TableCell className="py-2 px-3">
                <div className="flex items-center gap-1 justify-end">
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-slate-400 hover:text-red-500" 
                        onClick={onCancel}
                        disabled={isCreating}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100" 
                        onClick={() => onSave(val)}
                        disabled={isCreating}
                    >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

// --- Order Cell with Up/Down Arrows ---

function OrderCell({ row, router, isOrderSorted, categoryBoundaries }: { 
    row: any; 
    router: any; 
    isOrderSorted: boolean;
    categoryBoundaries: Map<number, { isFirst: boolean; isLast: boolean }>;
}) {
    const field = row.original;
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(field.order?.toString() || "0");
    const [movingDir, setMovingDir] = useState<"up" | "down" | null>(null);

    useEffect(() => {
        if (!isEditing) setVal(field.order?.toString() || "0");
    }, [field.order, isEditing]);

    const handleSave = async () => {
        setIsEditing(false);
        const processedVal = parseFloat(val);
        if (processedVal !== field.order) {
            const res = await updateMasterField(field.fieldNo, { order: processedVal });
            if (res.success) toast.success("Order updated");
            else setVal(field.order?.toString() || "0");
            router.refresh();
        }
    };

    const handleMove = async (direction: "up" | "down") => {
        setMovingDir(direction);
        try {
            const res = await moveFieldOrder(field.fieldNo, direction);
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Could not move");
            }
        } catch {
            toast.error("Failed to reorder");
        } finally {
            setMovingDir(null);
        }
    };

    const bounds = categoryBoundaries.get(field.fieldNo);

    if (isEditing) {
        return <Input autoFocus type="number" value={val} onChange={(e) => setVal(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setIsEditing(false); setVal(field.order?.toString() || "0"); } }} className="h-7 text-xs w-16" />;
    }

    return (
        <div className="flex items-center gap-0.5">
            {isOrderSorted && (
                <div className="flex flex-col -space-y-0.5">
                    <button
                        onClick={() => handleMove("up")}
                        disabled={!!movingDir || bounds?.isFirst}
                        className={cn(
                            "p-0 h-4 w-4 flex items-center justify-center rounded transition-colors",
                            bounds?.isFirst 
                                ? "text-slate-200 cursor-not-allowed" 
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        )}
                        title="Move up"
                    >
                        {movingDir === "up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                    </button>
                    <button
                        onClick={() => handleMove("down")}
                        disabled={!!movingDir || bounds?.isLast}
                        className={cn(
                            "p-0 h-4 w-4 flex items-center justify-center rounded transition-colors",
                            bounds?.isLast 
                                ? "text-slate-200 cursor-not-allowed" 
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        )}
                        title="Move down"
                    >
                        {movingDir === "down" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                </div>
            )}
            <Badge onClick={() => setIsEditing(true)} variant="secondary" className="bg-slate-100 text-slate-700 font-normal cursor-pointer hover:bg-slate-200">{val}</Badge>
        </div>
    );
}

