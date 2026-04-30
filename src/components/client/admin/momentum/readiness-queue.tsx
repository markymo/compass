"use client";

import React, { useState, useMemo } from "react";
import { 
    Search, 
    CheckCircle2, 
    XCircle,
    Filter
} from "lucide-react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FieldReadinessRow } from "@/actions/momentum";

interface ReadinessQueueProps {
    fields: FieldReadinessRow[];
}

export function ReadinessQueue({ fields }: ReadinessQueueProps) {
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");

    const categories = useMemo(() => {
        const unique = Array.from(new Set(fields.map(f => f.categoryName)));
        return unique.sort();
    }, [fields]);

    const filteredFields = useMemo(() => {
        return fields.filter(f => {
            const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) || 
                                 f.fieldNo.toString().includes(search);
            const matchesCategory = filterCategory === "all" || f.categoryName === filterCategory;
            
            let matchesStatus = true;
            if (filterStatus === "incomplete") matchesStatus = !f.isFullyComplete;
            else if (filterStatus === "desc_missing") matchesStatus = !f.descriptionStatus;
            else if (filterStatus === "map_missing") matchesStatus = !f.ukMappingStatus;
            else if (filterStatus === "complete") matchesStatus = f.isFullyComplete;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [fields, search, filterCategory, filterStatus]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                            className="pl-9 h-9"
                            placeholder="Search fields..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="incomplete">Incomplete Only</SelectItem>
                            <SelectItem value="desc_missing">Description Missing</SelectItem>
                            <SelectItem value="map_missing">Mapping Missing</SelectItem>
                            <SelectItem value="complete">Fully Complete</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
                    Showing {filteredFields.length} of {fields.length} fields
                </div>
            </div>

            <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="w-[80px]">No.</TableHead>
                            <TableHead className="min-w-[200px]">Field Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">Description</TableHead>
                            <TableHead className="text-center">UK Mapping</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFields.map((field) => (
                            <TableRow key={field.fieldNo} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="font-mono text-xs text-slate-400">{field.fieldNo}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{field.fieldName}</TableCell>
                                <TableCell>
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                        {field.categoryName}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    {field.descriptionStatus ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-slate-200 mx-auto" />
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {field.ukMappingStatus ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-slate-200 mx-auto" />
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {field.isFullyComplete ? (
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px]">READY</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">INCOMPLETE</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-700">
                                    {field.actionsToComplete > 0 && (
                                        <span className="text-indigo-600 text-xs">
                                            {field.actionsToComplete} left
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredFields.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                        No fields match your current filters.
                    </div>
                )}
            </div>
        </div>
    );
}
