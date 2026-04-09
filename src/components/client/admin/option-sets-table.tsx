"use client";
import { cn } from "@/lib/utils";
import React, { useState, useMemo } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MoreVertical, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OptionSetSheet } from "./option-set-sheet";
import { OptionSetValueType } from "@/types/master-data";
import { updateOptionSet } from "@/actions/master-data-option-sets";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OptionSetsTableProps {
    initialOptionSets: any[];
}

export function OptionSetsTable({ initialOptionSets }: OptionSetsTableProps) {
    const router = useRouter();
    const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
    const [search, setSearch] = useState("");
    
    const [selectedOptionSet, setSelectedOptionSet] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const data = useMemo(() => [...initialOptionSets].filter((o: any) => {
        return o.name.toLowerCase().includes(search.toLowerCase()) || 
               (o.description || "").toLowerCase().includes(search.toLowerCase());
    }), [initialOptionSets, search]);

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const res = await updateOptionSet(id, { isActive: !currentStatus });
        if (res.success) {
            toast.success(currentStatus ? "Deactivated" : "Activated");
            router.refresh();
        } else {
            toast.error("Failed to update status");
        }
    };

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "name",
            header: "Name",
            size: 200,
            cell: ({ row }) => <div className="font-semibold text-slate-900">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "description",
            header: "Description",
            size: 300,
            cell: ({ row }) => <div className="text-slate-500 text-sm truncate">{row.getValue("description") || "-"}</div>,
        },
        {
            accessorKey: "valueType",
            header: "Value Type",
            size: 100,
            cell: ({ row }) => (
                <Badge variant="outline" className="font-mono text-xs text-slate-500 bg-slate-50">
                    {row.getValue("valueType")}
                </Badge>
            ),
        },
        {
            id: "optionCount",
            header: "Options",
            size: 100,
            cell: ({ row }) => {
                const opts = row.original.options;
                return <div className="text-sm text-slate-600">{Array.isArray(opts) ? opts.length : 0} items</div>;
            }
        },
        {
            accessorKey: "isActive",
            header: "Status",
            size: 100,
            cell: ({ row }) => (
                <div onClick={() => handleToggleActive(row.original.id, row.original.isActive)} className="cursor-pointer inline-block">
                    {row.original.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Active</Badge>
                    ) : (
                        <Badge variant="outline" className="text-slate-400 hover:bg-slate-50">Inactive</Badge>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            size: 60,
            cell: ({ row }) => (
                <div className="text-right">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-slate-400 hover:text-indigo-600 h-8 w-8"
                        onClick={() => {
                            setSelectedOptionSet(row.original);
                            setIsSheetOpen(true);
                        }}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ], [router]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: { sorting }
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-9 w-[250px] bg-white h-9 text-sm border-slate-200"
                        placeholder="Search option sets..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button 
                    onClick={() => {
                        setSelectedOptionSet(null);
                        setIsSheetOpen(true);
                    }} 
                    size="sm" 
                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                    <Plus className="h-4 w-4 mr-1" /> Create Option Set
                </Button>
            </div>

            <div className="border rounded-lg bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map(row => (
                                <TableRow key={row.id} className="hover:bg-indigo-50/30">
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell key={cell.id} className="py-2.5">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                                    No option sets found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {isSheetOpen && (
                <OptionSetSheet 
                    open={isSheetOpen} 
                    onOpenChange={setIsSheetOpen} 
                    optionSet={selectedOptionSet} 
                />
            )}
        </div>
    );
}
