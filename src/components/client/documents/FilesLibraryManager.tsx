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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Info, Download, ChevronRight } from 'lucide-react';
import { DocumentLibraryItemDTO } from '@/lib/documents/DocumentLibraryDTOs';
import { formatFileSize, formatFileType, formatDocumentDate, getDocumentIcon, formatDocumentStatus } from '@/lib/documents/document-formatters';
import { DocumentDetailDrawer } from './DocumentDetailDrawer';
import { StandardTooltip } from '@/components/ui/standard-tooltip';
import { LibraryUploader } from './LibraryUploader';

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
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold">Files Library</CardTitle>
                </CardHeader>
                <CardContent>
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
                        <LibraryUploader clientLEId={clientLEId} />
                    </div>

                    {initialFiles.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                            <Info className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-gray-500 font-medium">No documents have been added.</p>
                            <p className="text-gray-400 text-sm mt-1">Files uploaded to this organization will appear here.</p>
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                            <Search className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-gray-500 font-medium">No documents match your search.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow>
                                        <TableHead className="w-[30%]">Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Usage</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
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
                                            className="cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                                            aria-label={`View details for ${file.filename}`}
                                        >
                                            <TableCell className="font-medium text-gray-900">
                                                <div className="flex items-center gap-2">
                                                    {getDocumentIcon(file.mimeType)}
                                                    <span className="truncate max-w-[200px]" title={file.filename}>
                                                        {file.filename}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {formatFileType(file.mimeType, file.filename)}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {formatFileSize(file.sizeBytes)}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                <div className="flex flex-col">
                                                    <span>{formatDocumentDate(file.createdAt)}</span>
                                                    <span className="text-xs text-gray-400">{file.uploadedBy?.displayName || 'Unknown'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatDocumentStatus(file.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-gray-600">
                                                    <span className={file.currentUsageCount > 0 ? "font-medium text-gray-900" : ""}>
                                                        {file.currentUsageCount} current
                                                    </span>
                                                    <span className="mx-1.5 text-gray-300">·</span>
                                                    <span>{file.historicalUsageCount} historic</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <StandardTooltip content="Download Document">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            asChild 
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
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
                                                        className="text-gray-400 hover:text-gray-900"
                                                        aria-label={`View details for ${file.filename}`}
                                                    >
                                                        <ChevronRight className="h-5 w-5" />
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
