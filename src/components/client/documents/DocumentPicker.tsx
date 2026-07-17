'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FileText } from 'lucide-react';
import { DocumentPickerItem } from '@/actions/document-library-actions';

export type PickerMode =
    | { type: "ADD" }
    | { type: "REPLACE"; instanceId: string };

export interface DocumentPickerProps {
    isOpen: boolean;
    onClose: () => void;
    documents: DocumentPickerItem[];
    onSelect: (document: DocumentPickerItem) => void;
    disabledDocumentIds?: string[];
    mode: PickerMode;
}

function formatBytes(bytes: number | null) {
    if (bytes === null) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    else if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    else return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function DocumentPicker({ isOpen, onClose, documents, onSelect, disabledDocumentIds = [], mode }: DocumentPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDocs = documents.filter(doc => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return doc.fileName.toLowerCase().includes(q) || (doc.mimeType && doc.mimeType.toLowerCase().includes(q));
    });

    const isAllAttached = documents.length > 0 && documents.every(d => disabledDocumentIds.includes(d.id));

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Choose a document</DialogTitle>
                    <DialogDescription>
                        Select an existing document from the Files Library to {mode.type === 'ADD' ? 'add as an attachment' : 'replace the current attachment'}.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 mt-2 mb-4 shrink-0">
                    <Search className="w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9"
                    />
                </div>

                <div className="flex-1 overflow-auto border rounded-md relative min-h-[300px]">
                    {documents.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                            <FileText className="w-8 h-8 mb-2 text-slate-300" />
                            <p className="font-medium text-slate-700">No documents are available in the Files Library.</p>
                            <p className="text-sm mt-1">Upload a document first.</p>
                        </div>
                    ) : isAllAttached && !searchQuery.trim() ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                            <FileText className="w-8 h-8 mb-2 text-slate-300" />
                            <p className="font-medium text-slate-700">All available documents are already attached to this field.</p>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                            No documents match your search.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 border-b shadow-sm z-10">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-slate-600">File name</th>
                                    <th className="px-4 py-3 font-medium text-slate-600 w-24">Type</th>
                                    <th className="px-4 py-3 font-medium text-slate-600 w-24">Size</th>
                                    <th className="px-4 py-3 font-medium text-slate-600 w-32">Added</th>
                                    <th className="px-4 py-3 font-medium text-slate-600 w-32 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredDocs.map(doc => {
                                    const isDisabled = disabledDocumentIds.includes(doc.id);
                                    
                                    let ext = doc.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                                    if (ext.length > 5) ext = 'FILE'; // Fallback if no clean extension
                                    
                                    const sizeDisplay = formatBytes(doc.sizeBytes);
                                        
                                    const dateDisplay = new Date(doc.createdAt).toLocaleDateString(undefined, {
                                        day: 'numeric', month: 'short', year: 'numeric'
                                    });

                                    return (
                                        <tr key={doc.id} className={isDisabled ? "bg-slate-50 opacity-60" : "hover:bg-slate-50 transition-colors"}>
                                            <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[250px]" title={doc.fileName}>
                                                {doc.fileName}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">{ext}</td>
                                            <td className="px-4 py-3 text-slate-500">{sizeDisplay}</td>
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{dateDisplay}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant={isDisabled ? "ghost" : "secondary"}
                                                    size="sm"
                                                    disabled={isDisabled}
                                                    onClick={() => onSelect(doc)}
                                                >
                                                    {isDisabled ? 'Already attached' : 'Select'}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
