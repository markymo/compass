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
    VisibilityState,
} from "@tanstack/react-table";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Settings, HelpCircle, Check, X, Loader2, MoreVertical, SlidersHorizontal, Plus, ChevronRight, ChevronDown, ChevronUp, GripVertical, Save, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { FieldDetailSheet } from "./field-detail-sheet";
import { FieldCreateSheet } from "./field-create-sheet";
import { updateFieldDescription } from "@/actions/master-data-ai";
import { updateMasterField } from "@/actions/master-data-governance";
import { syncCategoriesFromFields, updateCategoryOrder, updateFieldOrder, moveFieldOrder } from "@/actions/master-data-sort";
import { setSystemSetting } from "@/actions/system";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MasterDataManagerProps {
    initialData: any;
    rawFields: any[];
    initialNote: string;
}

export default function MasterDataManager({ initialData, rawFields, initialNote }: MasterDataManagerProps) {
    const router = useRouter();

    // -- Note State --
    const [note, setNote] = useState(initialNote || "");
    const [isSavingNote, setIsSavingNote] = useState(false);

    // -- Sort/Category State --
    const [categories, setCategories] = useState<any[]>(initialData.categories || []);
    const [uncategorizedFields, setUncategorizedFields] = useState<any[]>(initialData.uncategorizedFields || []);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    // -- Table States --
    const [sorting, setSorting] = useState<SortingState>([{ id: "order", desc: false }]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

    const handleSaveNote = async () => {
        setIsSavingNote(true);
        const res = await setSystemSetting("ADMIN_MANAGER_NOTE", note);
        setIsSavingNote(false);
        if (res.success) toast.success("Note saved globally");
        else toast.error("Failed to save note");
    };

    const toggleCollapse = (id: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === "CATEGORY") {
            const newCategories = Array.from(categories);
            const [moved] = newCategories.splice(source.index, 1);
            newCategories.splice(destination.index, 0, moved);
            newCategories.forEach((cat: any, index: any) => { cat.order = index; });
            setCategories(newCategories);
        } else if (type === "FIELD") {
            const sourceCatId = source.droppableId;
            const destCatId = destination.droppableId;
            
            if (sourceCatId !== destCatId) {
                const sourceCatIndex = categories.findIndex(c => c.id === sourceCatId);
                const destCatIndex = categories.findIndex(c => c.id === destCatId);

                if (sourceCatIndex !== -1 && destCatIndex !== -1) {
                    const newCategories = Array.from(categories);
                    const sourceFields = Array.from(newCategories[sourceCatIndex].fields);
                    const destFields = Array.from(newCategories[destCatIndex].fields);
                    const [moved] = sourceFields.splice(source.index, 1);
                    (moved as any).categoryId = destCatId;
                    destFields.splice(destination.index, 0, moved);

                    newCategories[sourceCatIndex].fields = sourceFields;
                    newCategories[destCatIndex].fields = destFields;
                    newCategories[destCatIndex].fields.forEach((f: any, idx: any) => f.order = idx);
                    newCategories[sourceCatIndex].fields.forEach((f: any, idx: any) => f.order = idx);
                    setCategories(newCategories);
                }
            } else {
                const catIndex = categories.findIndex(c => c.id === sourceCatId);
                if (catIndex !== -1) {
                    const newCategories = Array.from(categories);
                    const newFields = Array.from(newCategories[catIndex].fields);
                    const [moved] = newFields.splice(source.index, 1);
                    newFields.splice(destination.index, 0, moved);
                    newFields.forEach((f: any, idx: any) => f.order = idx);
                    newCategories[catIndex].fields = newFields;
                    setCategories(newCategories);
                }
            }
        }
    };

    const handleSaveCategories = async () => {
        setIsSavingOrder(true);
        try {
            const payload = categories.map((c: any) => ({ id: c.id, order: c.order }));
            await updateCategoryOrder(payload);
            toast.success("Category order saved successfully");
            router.refresh();
        } catch (e) {
            toast.error("Failed to save category order");
        } finally {
            setIsSavingOrder(false);
        }
    };

    const handleSaveFields = async () => {
        setIsSavingOrder(true);
        try {
            const payload = categories.flatMap((c: any) => c.fields.map((f: any) => ({ 
                fieldNo: f.fieldNo, 
                order: f.order,
                categoryId: c.id 
            })));
            await updateFieldOrder(payload);
            toast.success("Field order saved successfully");
            router.refresh();
        } catch (e) {
            toast.error("Failed to save field order");
        } finally {
            setIsSavingOrder(false);
        }
    };

    const handleSync = async () => {
        if (!confirm("Run internal migration for categories?")) return;
        setIsSyncing(true);
        try {
            await syncCategoriesFromFields();
            toast.success("Categories synced successfully");
            router.refresh();
        } catch (e) {
            toast.error("Error syncing categories");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleInsertBelow = (field: any) => {
        let newOrder = (field.order || 0) + 10;
        setNewFieldDraft({
            fieldName: "",
            description: "",
            appDataType: "TEXT",
            category: field.category || undefined,
            categoryId: field.categoryId || undefined,
            fmsbRef: field.fmsbRef || undefined,
            domain: field.domain || ["Onboarding"],
            order: newOrder
        });
        setInsertingBelowFieldNo(field.fieldNo);
    };

    const handleCreateField = async (draft: any) => {
        if (!draft.fieldName.trim()) { toast.error("Field name is required"); return; }
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

    // Integrate flat fields for search visibility and table context
    const flatFields = useMemo(() => {
        const out = categories.flatMap(c => c.fields);
        return [...out, ...uncategorizedFields];
    }, [categories, uncategorizedFields]);

    const data = useMemo(() => flatFields.filter((f: any) => {
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
    }), [flatFields, search, filterCategory, filterDomain, filterDataType, filterStatus]);

    const uniqueCategories = Array.from(new Set(rawFields.map(f => f.category || "General"))).sort();
    const uniqueDomains = Array.from(new Set(rawFields.flatMap(f => f.domain && f.domain.length > 0 ? f.domain : ["None"]))).sort();
    const uniqueDataTypes = Array.from(new Set(rawFields.map(f => f.appDataType))).sort();

    const clearFilters = () => {
        setFilterCategory("all"); setFilterDomain("all"); setFilterDataType("all"); setFilterStatus("all"); setSearch("");
    };

    const hasActiveFilters = filterCategory !== "all" || filterDomain !== "all" || filterDataType !== "all" || filterStatus !== "all" || search !== "";

    // Build category boundaries for the fallback arrows functionality
    const categoryBoundaries = useMemo(() => {
        const result = new Map<number, { isFirst: boolean; isLast: boolean }>();
        categories.forEach(c => {
            c.fields.forEach((f: any, i: number) => {
                result.set(f.fieldNo, { isFirst: i === 0, isLast: i === c.fields.length - 1 });
            });
        });
        return result;
    }, [categories]);

    // Columns Definition
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "fieldNo",
            header: "No.",
            size: 60,
            cell: ({ row }) => <div className="font-medium text-slate-400 font-mono text-xs">{row.original.fieldNo}</div>,
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
            accessorKey: "fmsbRef",
            header: "FMSB Ref.",
            size: 100,
            cell: ({ row }) => <EditableTextCell key={row.original.fieldNo + "_fmsb"} row={row} fieldKey="fmsbRef" fallback="-" router={router} />,
        },
        {
            accessorKey: "domain",
            header: "Domain",
            size: 140,
            cell: ({ row }) => <EditableTagsCell key={row.original.fieldNo} row={row} fieldKey="domain" router={router} />,
        },
        {
            accessorKey: "appDataType",
            header: "Data Type",
            size: 100,
            cell: ({ row }) => <EditableSelectCell key={row.original.fieldNo} row={row} fieldKey="appDataType" options={["TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON", "SELECT"]} router={router} />,
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
                        {uniqueSources.map((source: any) => <Badge key={source as string} variant="outline" className="px-1.5 py-0 h-4 text-[9px] bg-slate-50">{source as string}</Badge>)}
                    </div>
                );
            }
        },
        {
            accessorKey: "order",
            header: "Order",
            size: 90,
            cell: ({ row }) => <OrderCell key={row.original.fieldNo + "_order"} row={row} router={router} isOrderSorted={true} categoryBoundaries={categoryBoundaries} />,
        },
        {
            accessorKey: "isActive",
            header: "Status",
            size: 80,
            cell: ({ row }) => <EditableStatusCell key={row.original.fieldNo} row={row} router={router} />,
        },
        {
            id: "actions",
            size: 60,
            cell: ({ row }) => (
                <div className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedField(row.original); setIsEditDialogOpen(true); }}>
                                <Settings className="mr-2 h-4 w-4 text-slate-400" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleInsertBelow(row.original)}>
                                <Plus className="mr-2 h-4 w-4 text-emerald-500" /> Insert Below
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        }
    ], [router, categoryBoundaries]);

    const table = useReactTable({
        data,
        columns,
        columnResizeMode: "onChange",
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: { sorting, columnVisibility }
    });

    // Extract sizes for CSS Grid styling representing the flat table columns + drag handle
    const gridTemplateColumns = `40px ${table.getVisibleLeafColumns().map(c => `${c.getSize()}px`).join(" ")}`;

    return (
        <div className="space-y-6">
            {/* Global Note Section */}
            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 pb-3 relative">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <Button onClick={handleSaveNote} disabled={isSavingNote} size="sm" variant="outline" className="h-8 bg-white border-amber-300 text-amber-700 hover:bg-amber-50">
                        {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save Note
                    </Button>
                </div>
                <div className="font-semibold text-amber-800 dark:text-amber-500 flex items-center gap-2 mb-2 text-sm">
                    <HelpCircle className="w-4 h-4" /> Global Notice Board 
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700">God Admin</span>
                </div>
                <Textarea 
                    value={note} 
                    onChange={e => setNote(e.target.value)}
                    placeholder="E.g. Bugs, Feature Requests, Comments..." 
                    className="min-h-[80px] bg-white/60 dark:bg-slate-900/40 text-sm border-amber-200 resize-y"
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
                 <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input className="pl-9 w-[200px] h-9 text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[125px] h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Categories</SelectItem>{uniqueCategories.map(cat => <SelectItem key={cat as string} value={cat as string}>{cat as string}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDomain} onValueChange={setFilterDomain}>
                        <SelectTrigger className="w-[125px] h-9 text-xs"><SelectValue placeholder="Domain" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Domains</SelectItem>{uniqueDomains.map(dom => <SelectItem key={dom as string} value={dom as string}>{dom as string}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterDataType} onValueChange={setFilterDataType}>
                        <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue placeholder="Data Type" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueDataTypes.map(type => <SelectItem key={type as string} value={type as string}>{type as string}</SelectItem>)}</SelectContent>
                    </Select>
                    {hasActiveFilters && <Button variant="ghost" size="sm" className="h-9 px-2 text-slate-500" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Clear</Button>}
                </div>
                <div className="flex items-center gap-2 mt-2 xl:mt-0 justify-end">
                    <Button variant="outline" size="sm" onClick={handleSaveCategories} disabled={isSavingOrder} className="h-9 gap-1.5 shadow-sm text-sm"><Save className="w-3.5 h-3.5" /> Save Categories</Button>
                    <Button variant="outline" size="sm" onClick={handleSaveFields} disabled={isSavingOrder} className="h-9 gap-1.5 shadow-sm text-sm"><Save className="w-3.5 h-3.5" /> Save Fields</Button>
                    <Button variant="secondary" size="sm" onClick={handleSync} disabled={isSyncing} className="h-9 gap-1.5 shadow-sm text-sm">
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} /> Sync
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm text-sm"><SlidersHorizontal className="h-4 w-4" /> Columns</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            {table.getAllColumns().filter(col => col.getCanHide()).map(column => (
                                <DropdownMenuCheckboxItem key={column.id} className="capitalize" checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                                    {column.id.replace(/([A-Z])/g, ' $1').trim()}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">Add Field</Button>
                </div>
            </div>

            {/* Draggable Table Structure */}
            <div className="border rounded-lg bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex flex-col">
                <div 
                    className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs py-2 px-3 select-none"
                    style={{ display: "grid", gridTemplateColumns }}
                >
                    <div /> {/* Handle Column Header placeholder */}
                    {table.getHeaderGroups()[0].headers.map(header => (
                        <div key={header.id} className="relative flex items-center pr-2" style={{ width: "100%" }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanResize() && (
                                <div 
                                    onMouseDown={header.getResizeHandler()} 
                                    onTouchStart={header.getResizeHandler()} 
                                    className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500 ${header.column.getIsResizing() ? "bg-indigo-500" : ""}`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="overflow-auto pb-8">
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="categories" type="CATEGORY">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                                    {categories.map((category: any, index: number) => {
                                        // Only show matched fields if filters are active
                                        const visibleFieldsMap = new Set(data.map(d => d.fieldNo));
                                        const visibleCategoryFields = category.fields.filter((f: any) => visibleFieldsMap.has(f.fieldNo));
                                        
                                        if (hasActiveFilters && visibleCategoryFields.length === 0) return null; // Hide empty categories when filtering

                                        return (
                                            <Draggable key={category.id} draggableId={category.id} index={index}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} className="border-b border-slate-200 last:border-b-0 bg-slate-50/50">
                                                        <div className="flex items-center p-2 bg-slate-100/80 border-b border-slate-200 group">
                                                            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                            <button onClick={() => toggleCollapse(category.id)} className="flex items-center gap-2 font-semibold text-sm text-slate-700 ml-2">
                                                                {collapsedCategories.has(category.id) ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                                                {category.displayName}
                                                                <Badge variant="outline" className="text-[10px] font-normal text-slate-500 bg-white shadow-sm ml-2">{category.fields.length}</Badge>
                                                            </button>
                                                        </div>
                                                        
                                                        {!collapsedCategories.has(category.id) && (
                                                            <Droppable droppableId={category.id} type="FIELD">
                                                                {(provided) => (
                                                                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col bg-white">
                                                                        {category.fields.map((field: any, fIndex: number) => {
                                                                            if (hasActiveFilters && !visibleFieldsMap.has(field.fieldNo)) return null;
                                                                            
                                                                            const tableRow = table.getRowModel().rows.find(r => r.original.fieldNo === field.fieldNo);
                                                                            if (!tableRow) return null;

                                                                            return (
                                                                                <Draggable key={field.fieldNo.toString()} draggableId={field.fieldNo.toString()} index={fIndex}>
                                                                                    {(provided, snapshot) => (
                                                                                        <React.Fragment>
                                                                                            <div 
                                                                                                ref={provided.innerRef} 
                                                                                                {...provided.draggableProps}
                                                                                                className={cn("border-b border-slate-100 last:border-b-0 hover:bg-indigo-50/30 transition-colors py-1.5 px-3 min-w-max", snapshot.isDragging && "bg-indigo-50 shadow-md ring-1 ring-indigo-200 z-50")}
                                                                                                style={{ ...provided.draggableProps.style, display: "grid", gridTemplateColumns, alignItems: 'start' }}
                                                                                            >
                                                                                                <div {...provided.dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                                                                                                    <GripVertical className="w-4 h-4" />
                                                                                                </div>
                                                                                                {tableRow.getVisibleCells().map(cell => (
                                                                                                    <div key={cell.id} className="overflow-hidden pr-2">
                                                                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                            {insertingBelowFieldNo === field.fieldNo && (
                                                                                                <div className="w-full bg-emerald-50 border-b border-emerald-100 flex items-center justify-center p-2 text-xs italic text-emerald-600">
                                                                                                    Creation of new fields must be handled via modal...
                                                                                                </div>
                                                                                            )}
                                                                                        </React.Fragment>
                                                                                    )}
                                                                                </Draggable>
                                                                            );
                                                                        })}
                                                                        {provided.placeholder}
                                                                    </div>
                                                                )}
                                                            </Droppable>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}

                                    {uncategorizedFields.length > 0 && (!hasActiveFilters || uncategorizedFields.some(f => data.some(d => d.fieldNo === f.fieldNo))) && (
                                         <div className="border-b border-slate-200 bg-orange-50/50">
                                            <div className="flex items-center p-2 border-b border-slate-200">
                                                <div className="font-semibold text-sm text-orange-800 ml-8 flex items-center gap-2">
                                                    Uncategorized Fields
                                                    <Badge variant="outline" className="text-[10px] font-normal text-orange-800 bg-white border-orange-200">{uncategorizedFields.length}</Badge>
                                                </div>
                                            </div>
                                            <div className="flex flex-col bg-white">
                                                {uncategorizedFields.map((field: any) => {
                                                    const tableRow = table.getRowModel().rows.find(r => r.original.fieldNo === field.fieldNo);
                                                    if (!tableRow || (hasActiveFilters && !data.some(d => d.fieldNo === field.fieldNo))) return null;
                                                    return (
                                                        <div key={field.fieldNo} className="border-b border-slate-100 py-1.5 px-3 opacity-60 pointer-events-none min-w-max" style={{ display: "grid", gridTemplateColumns }}>
                                                            <div className="mt-1"><GripVertical className="w-4 h-4 text-slate-200" /></div>
                                                            {tableRow.getVisibleCells().map(cell => (
                                                                <div key={cell.id} className="overflow-hidden pr-2">
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                         </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
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
        <div className="bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40 transition-colors animate-in fade-in slide-in-from-top-1 duration-200 flex items-center justify-between px-4 py-3">
             <span className="text-sm text-emerald-700 italic">Inline creation requires modal. Click &apos;Add Field&apos; in header.</span>
             <Button variant="outline" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1"/> Close</Button>
        </div>
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

