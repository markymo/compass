"use client";

import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Info, Download, ChevronRight, FileText } from 'lucide-react';
import { DocumentLibraryItemDTO } from '@/lib/documents/DocumentLibraryDTOs';
import { formatFileSize, formatFileType, formatDocumentDate, getDocumentIcon, formatDocumentStatus } from '@/lib/documents/document-formatters';
import { DocumentDetailDrawer } from './DocumentDetailDrawer';
import { StandardTooltip } from '@/components/ui/standard-tooltip';
import { LibraryUploader } from './LibraryUploader';
import { cn } from '@/lib/utils';

interface FilesLibraryManagerProps {
    clientLEId: string;
    initialFiles: DocumentLibraryItemDTO[];
}

export function FilesLibraryManager({ clientLEId, initialFiles }: FilesLibraryManagerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const handleRowClick = (docId: string) => {
        setSelectedDocumentId(docId);
        setIsDrawerOpen(true);
    };

    const handleViewDetails = (e: React.MouseEvent | React.KeyboardEvent, docId: string) => {
        e.stopPropagation();
        handleRowClick(docId);
    };

    // Case-insensitive filename search
    const filteredFiles = initialFiles.filter(file => 
        file.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Action Row */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5 text-slate-800">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">Files</h2>
                </div>
                <LibraryUploader clientLEId={clientLEId} />
            </div>

            <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6 gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search files by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {initialFiles.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                            <Info className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-gray-500 font-medium mb-4">No files uploaded yet.</p>
                            <LibraryUploader clientLEId={clientLEId} label="Add your first file" />
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                            <Search className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-gray-500 font-medium">No documents match your search.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table className="w-full table-fixed">
                                <TableHeader className="bg-slate-50/70">
                                    <TableRow>
                                        <TableHead className="w-[44%] px-4 py-3 text-xs text-slate-500 font-semibold">File</TableHead>
                                        <TableHead className="w-[22%] px-4 py-3 text-xs text-slate-500 font-semibold">Uploaded</TableHead>
                                        <TableHead className="w-[16%] px-4 py-3 text-xs text-slate-500 font-semibold">Status</TableHead>
                                        <TableHead className="w-[10%] px-4 py-3 text-xs text-slate-500 font-semibold text-center">Current</TableHead>
                                        <TableHead className="w-[8%] px-4 py-3 text-xs text-slate-500 font-semibold text-right">
                                            <span className="sr-only">Actions</span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredFiles.map((file) => (
                                        <TableRow 
                                            key={file.id} 
                                            onClick={() => handleRowClick(file.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleRowClick(file.id);
                                                }
                                            }}
                                            tabIndex={0}
                                            className="cursor-pointer hover:bg-slate-50/80 transition-colors focus:outline-none focus:bg-slate-50 group"
                                            aria-label={`View details for ${file.filename}`}
                                        >
                                            <TableCell className="px-4 py-3 font-medium text-slate-900 overflow-hidden">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="shrink-0 text-slate-400">{getDocumentIcon(file.mimeType)}</span>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="truncate min-w-0 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors" title={file.filename}>
                                                            {file.filename}
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-normal truncate">
                                                            {formatFileType(file.mimeType, file.filename)} · {formatFileSize(file.sizeBytes)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-xs text-slate-600">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-slate-800 truncate" title={formatDocumentDate(file.createdAt)}>{formatDocumentDate(file.createdAt)}</span>
                                                    <span className="text-[11px] text-slate-400 truncate" title={file.uploadedBy?.displayName || 'Unknown'}>{file.uploadedBy?.displayName || 'Unknown'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                                                {formatDocumentStatus(file.status)}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-xs text-center">
                                                <span className={cn("text-sm font-semibold font-mono", file.currentUsageCount > 0 ? "text-slate-900" : "text-slate-400")}>
                                                    {file.currentUsageCount}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-3 py-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <StandardTooltip content="Download Document">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            asChild 
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                                                        >
                                                            <a href={`/api/documents/${file.id}/download`}>
                                                                <Download className="h-4 w-4" />
                                                                <span className="sr-only">Download {file.filename}</span>
                                                            </a>
                                                        </Button>
                                                    </StandardTooltip>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={(e) => handleViewDetails(e, file.id)}
                                                        className="h-8 w-8 text-slate-400 hover:text-slate-900 shrink-0"
                                                        aria-label={`View details for ${file.filename}`}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <DocumentDetailDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                documentId={selectedDocumentId} 
                clientLEId={clientLEId} 
            />
        </div>
    );
}
