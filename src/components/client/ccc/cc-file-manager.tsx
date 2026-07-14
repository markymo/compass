"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Layers, File, ExternalLink } from "lucide-react";
import { CCFileRecord } from "@/actions/cc-file-actions";

interface CCFileManagerProps {
    clientLEId: string;
    initialFiles: CCFileRecord[];
}

export function CCFileManager({ initialFiles }: CCFileManagerProps) {
    return (
        <div className="space-y-6 mt-10">
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-base font-bold tracking-tight text-slate-800">
                        Files & Documents
                    </h3>
                </div>
            </div>

            {/* Files List Card */}
            <Card className="border-slate-200/80 shadow-xs overflow-hidden rounded-xl">
                <CardContent className="p-0">
                    {initialFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-3 bg-slate-50 rounded-full border border-slate-100 text-slate-400 mb-4">
                                <Layers className="h-6 w-6" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">No attached files</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                No files have been attached to fields for this legal entity yet.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Name
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Type
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider">
                                            Usage
                                        </TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-3 px-5 tracking-wider text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialFiles.map((file) => (
                                        <TableRow key={file.id} className="hover:bg-slate-50/40 border-b border-slate-100 last:border-0 transition-colors duration-150">
                                            <TableCell className="py-3 px-5 font-semibold text-slate-800 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <File className="h-4 w-4 text-slate-400" />
                                                    <span className="truncate max-w-[300px]" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3 px-5 text-sm">
                                                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                                    {file.fileType || "UNKNOWN"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 px-5 text-sm">
                                                {file.usage.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-semibold text-xs text-slate-700">Used in {file.usage.length} field{file.usage.length !== 1 ? 's' : ''}</span>
                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                            {file.usage.slice(0, 3).map((u) => (
                                                                <span key={u.fieldNo} className="text-[10px] text-slate-500 max-w-[250px] truncate" title={`Field ${u.fieldNo} — ${u.fieldName}`}>
                                                                    Field {u.fieldNo} — {u.fieldName}
                                                                </span>
                                                            ))}
                                                            {file.usage.length > 3 && (
                                                                <span className="text-[10px] text-slate-400 italic">+{file.usage.length - 3} more...</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No references</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 px-5 text-right">
                                                <a
                                                    href={file.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center h-8.5 w-8.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all duration-150"
                                                    title="View file"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
