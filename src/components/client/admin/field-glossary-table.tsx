"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Settings, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldEditDialog } from "./field-edit-dialog";

interface FieldGlossaryTableProps {
    initialFields: any[];
}

export function FieldGlossaryTable({ initialFields }: FieldGlossaryTableProps) {
    const [search, setSearch] = useState("");
    const [selectedField, setSelectedField] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const filteredFields = [...initialFields].filter(f =>
        f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
        (f.category || "").toLowerCase().includes(search.toLowerCase()) ||
        f.fieldNo.toString() === search
    );

    if (sortConfig !== null) {
        filteredFields.sort((a, b) => {
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

    return (
        <div className="space-y-4">
            <div className="flex gap-2 justify-end mb-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-9 w-[300px] bg-white dark:bg-slate-900"
                        placeholder="Search fields by name, category or No..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline">Export CSV</Button>
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
                                        {field.notes ? (
                                            <span className="text-[11px] text-slate-500 line-clamp-1 italic">{field.notes}</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-300 italic">No description provided</span>
                                        )}
                                        {field.isMultiValue && <span className="text-[10px] mt-1 uppercase tracking-wider text-blue-600 font-bold dark:text-blue-400">Repeating</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-normal">
                                        {field.category || "General"}
                                    </Badge>
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
                                        <Settings className="h-4 w-4" />
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
                <FieldEditDialog
                    field={selectedField}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                />
            )}
        </div>
    );
}
