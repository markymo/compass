"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Settings, HelpCircle, Check, X, Loader2, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldDetailSheet } from "./field-detail-sheet";
import { FieldCreateSheet } from "./field-create-sheet";
import { useRouter } from "next/navigation";
import { updateFieldDescription } from "@/actions/master-data-ai";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FieldGlossaryTableProps {
    initialFields: any[];
}

export function FieldGlossaryTable({ initialFields }: FieldGlossaryTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [selectedField, setSelectedField] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Inline edit state
    const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
    const [editNotesText, setEditNotesText] = useState("");
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterDomain, setFilterDomain] = useState<string>("all");
    const [filterDataType, setFilterDataType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Dynamic unique options
    const uniqueCategories = Array.from(new Set(initialFields.map(f => f.category || "General"))).sort();
    const uniqueDomains = Array.from(new Set(initialFields.flatMap(f => f.domain && f.domain.length > 0 ? f.domain : ["None"]))).sort();
    const uniqueDataTypes = Array.from(new Set(initialFields.map(f => f.appDataType))).sort();

    const filteredFields = [...initialFields].filter((f: any) => {
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
    });

    const hasActiveFilters = filterCategory !== "all" || filterDomain !== "all" || filterDataType !== "all" || filterStatus !== "all";
    const clearFilters = () => {
        setFilterCategory("all");
        setFilterDomain("all");
        setFilterDataType("all");
        setFilterStatus("all");
    };

    if (sortConfig !== null) {
        filteredFields.sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle special cases
            if (sortConfig.key === 'fieldName') {
                aValue = a.fieldName.toLowerCase();
                bValue = b.fieldName.toLowerCase();
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? " ↑" : " ↓";
    };

    const handleEdit = (field: any) => {
        setSelectedField(field);
        setIsEditDialogOpen(true);
    };

    const startEditingNotes = (field: any) => {
        setEditingFieldId(field.fieldNo);
        setEditNotesText(field.notes || "");
    };

    const cancelEditingNotes = () => {
        setEditingFieldId(null);
        setEditNotesText("");
    };

    const handleSaveNotes = async (fieldNo: number) => {
        setIsSavingNotes(true);
        try {
            const res = await updateFieldDescription(fieldNo, editNotesText);
            if (res.success) {
                toast.success("Description updated");
                setEditingFieldId(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to update description");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSavingNotes(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9 w-[250px] bg-white dark:bg-slate-900 h-9"
                                placeholder="Search fields..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-slate-900 border-slate-200">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {uniqueCategories.map(cat => (
                                    <SelectItem key={cat as string} value={cat as string}>{cat as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterDomain} onValueChange={setFilterDomain}>
                            <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-slate-900 border-slate-200">
                                <SelectValue placeholder="Domain" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Domains</SelectItem>
                                {uniqueDomains.map(dom => (
                                    <SelectItem key={dom as string} value={dom as string}>{dom as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterDataType} onValueChange={setFilterDataType}>
                            <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-slate-900 border-slate-200">
                                <SelectValue placeholder="Data Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Data Types</SelectItem>
                                {uniqueDataTypes.map(type => (
                                    <SelectItem key={type as string} value={type as string}>{type as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[130px] h-9 bg-white dark:bg-slate-900 border-slate-200">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-2 text-slate-500 hover:text-slate-900"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4 mr-1" /> Clear
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9">Export CSV</Button>
                        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">Add Field</Button>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg bg-white dark:bg-slate-950 overflow-hidden shadow-sm border-slate-200 dark:border-slate-800">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                            <TableHead
                                className="w-[80px] cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => requestSort('fieldNo')}
                            >
                                No.{getSortIndicator('fieldNo')}
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => requestSort('fieldName')}
                            >
                                Field Name & Description{getSortIndicator('fieldName')}
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => requestSort('category')}
                            >
                                Category{getSortIndicator('category')}
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center gap-1">
                                    <span 
                                        className="cursor-pointer hover:text-indigo-600 transition-colors"
                                        onClick={() => requestSort('domain')}
                                    >
                                        Domain{getSortIndicator('domain')}
                                    </span>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 cursor-pointer" />
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>About Domains</DialogTitle>
                                                <DialogDescription asChild>
                                                    <div className="pt-3 space-y-3 font-normal text-slate-600 dark:text-slate-300 text-sm">
                                                        <p>
                                                            A <strong>Domain</strong> (sometimes considered a <i>Template</i>) groups data points by their business context or use case.
                                                        </p>
                                                        <p>
                                                            A field can hold an array of multiple domain tags (e.g., <em>"Onboarding"</em>, <em>"Insurance"</em>). You typically won't see more than 5 or 6 domains in total.
                                                        </p>
                                                        <p>
                                                            This concept is foundational for tenanted systems. For instance, if we spin up a version of this product for a customer managing insurance quotes or renewals, they will only see the documentation and data fields necessary for that specific Domain.
                                                        </p>
                                                    </div>
                                                </DialogDescription>
                                            </DialogHeader>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => requestSort('appDataType')}
                            >
                                Data Type{getSortIndicator('appDataType')}
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => requestSort('isActive')}
                            >
                                Status{getSortIndicator('isActive')}
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFields.map((field: any) => (
                            <TableRow key={field.fieldNo} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                                <TableCell className="font-medium text-slate-400 font-mono text-xs">{field.fieldNo}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col max-w-[400px]">
                                        <span className="font-semibold text-slate-900 dark:text-slate-200">{field.fieldName}</span>
                                        {editingFieldId === field.fieldNo ? (
                                            <div className="mt-1 space-y-2">
                                                <Textarea
                                                    autoFocus
                                                    value={editNotesText}
                                                    onChange={(e) => setEditNotesText(e.target.value)}
                                                    className="min-h-[60px] text-xs resize-none bg-white dark:bg-slate-900"
                                                    disabled={isSavingNotes}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSaveNotes(field.fieldNo);
                                                        } else if (e.key === 'Escape') {
                                                            cancelEditingNotes();
                                                        }
                                                    }}
                                                />
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={() => handleSaveNotes(field.fieldNo)}
                                                        disabled={isSavingNotes}
                                                    >
                                                        {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={cancelEditingNotes}
                                                        disabled={isSavingNotes}
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="group cursor-pointer rounded -ml-1 mt-0.5 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
                                                onClick={() => startEditingNotes(field)}
                                            >
                                                {field.notes ? (
                                                    <span className="text-[11px] text-slate-500 line-clamp-3 italic group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{field.notes}</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Click to add description...</span>
                                                )}
                                            </div>
                                        )}
                                        {field.isMultiValue && <span className="text-[10px] mt-1 uppercase tracking-wider text-blue-600 font-bold dark:text-blue-400">Repeating</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-normal">
                                        {field.category || "General"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {field.domain && field.domain.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {field.domain.map((d: string) => (
                                                <Badge key={d} variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 font-normal">
                                                    {d}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">None</span>
                                    )}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-500">
                                    {field.appDataType}
                                </TableCell>
                                <TableCell>
                                    {field.isActive ? (
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">Active</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800">Inactive</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                        onClick={() => handleEdit(field)}
                                        title="Edit Field Metadata"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredFields.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    No fields found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedField && (
                <FieldDetailSheet
                    field={selectedField}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                />
            )}

            {isCreateDialogOpen && (
                <FieldCreateSheet
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                />
            )}
        </div>
    );
}
