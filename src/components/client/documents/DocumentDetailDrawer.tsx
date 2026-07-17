"use client";

import React, { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { DocumentDetailDTO } from '@/lib/documents/DocumentLibraryDTOs';
import { getLibraryDocumentDetailsAction } from '@/actions/document-library-actions';
import { formatFileSize, formatFileType, formatDocumentDate } from '@/lib/documents/document-formatters';
import { DocumentUsageLabel } from './DocumentUsageLabel';

interface DocumentDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: string | null;
    clientLEId: string;
}

export function DocumentDetailDrawer({ isOpen, onClose, documentId, clientLEId }: DocumentDetailDrawerProps) {
    const [details, setDetails] = useState<DocumentDetailDTO | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDetails = async (id: string) => {
        setIsLoading(true);
        setError(null);
        setDetails(null); // Clear previous details

        try {
            const data = await getLibraryDocumentDetailsAction(id, clientLEId);
            // Ensure the user hasn't selected another document while this request was in flight
            setDetails((prev) => {
                // If the drawer is still open for the same ID, set the details
                return data;
            });
            setIsLoading(false);
        } catch (err: any) {
            setError("Unable to load document details");
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let isCurrent = true;

        const fetchDetails = async () => {
            if (!documentId || !isOpen) return;
            
            setIsLoading(true);
            setError(null);
            setDetails(null);

            try {
                const data = await getLibraryDocumentDetailsAction(documentId, clientLEId);
                if (isCurrent) {
                    setDetails(data);
                    setIsLoading(false);
                }
            } catch (err: any) {
                if (isCurrent) {
                    setError("Unable to load document details");
                    setIsLoading(false);
                }
            }
        };

        fetchDetails();

        return () => {
            isCurrent = false; // Ignore older requests if ID changes
        };
    }, [documentId, isOpen, clientLEId]);

    const handleRetry = () => {
        if (documentId) {
            loadDetails(documentId);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>Document Details</SheetTitle>
                    <SheetDescription>
                        View metadata and historical usage for this document.
                    </SheetDescription>
                </SheetHeader>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p>Loading details...</p>
                    </div>
                )}

                {!isLoading && error && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
                        <p className="mb-4 text-red-600">{error}</p>
                        <Button variant="outline" onClick={handleRetry}>Retry</Button>
                    </div>
                )}

                {!isLoading && !error && details && (
                    <div className="space-y-8">
                        <section>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Metadata</h3>
                            <dl className="space-y-3 text-sm">
                                <div className="grid grid-cols-3 gap-2">
                                    <dt className="text-gray-500">Filename</dt>
                                    <dd className="col-span-2 text-gray-900 break-words">{details.filename}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <dt className="text-gray-500">Type</dt>
                                    <dd className="col-span-2 text-gray-900">
                                        <div className="flex flex-col">
                                            <span>{formatFileType(details.mimeType, details.filename)}</span>
                                            <span className="text-xs text-gray-400 mt-0.5">{details.mimeType}</span>
                                        </div>
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <dt className="text-gray-500">Size</dt>
                                    <dd className="col-span-2 text-gray-900">{formatFileSize(details.sizeBytes)}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <dt className="text-gray-500">Uploaded</dt>
                                    <dd className="col-span-2 text-gray-900">{formatDocumentDate(details.createdAt)}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <dt className="text-gray-500">Uploaded by</dt>
                                    <dd className="col-span-2 text-gray-900">{details.uploadedBy?.displayName || 'Unknown'}</dd>
                                </div>
                            </dl>
                        </section>

                        <section>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Current Usage</h3>
                            {details.currentUsages.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">This document is not currently attached to any active records.</p>
                            ) : (
                                <ul className="space-y-4">
                                    {details.currentUsages.map((usage, idx) => (
                                        <li key={idx}>
                                            <DocumentUsageLabel usage={usage} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage History</h3>
                            {details.usageHistory.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No historical events recorded.</p>
                            ) : (
                                <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-4">
                                    {details.usageHistory.map((event, idx) => (
                                        <div key={event.eventId} className="relative pl-6">
                                            <div className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white ${event.action === 'ATTACHED' ? 'bg-blue-500' : event.action === 'REPLACED' ? 'bg-orange-500' : 'bg-red-500'}`} />
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 capitalize">{event.action.toLowerCase()}</span>
                                                    <span className="text-xs text-gray-500">{formatDocumentDate(event.timestamp)}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {event.action === 'ATTACHED' && `Attached to ${event.display.title}`}
                                                    {event.action === 'REMOVED' && `Removed from ${event.display.title}`}
                                                    {event.action === 'REPLACED' && (
                                                        <>
                                                            Replaced on {event.display.title}
                                                            {event.replacementFilename && <span className="block text-xs text-gray-500 mt-0.5">by {event.replacementFilename}</span>}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <div className="pt-4 border-t border-gray-100 pb-8">
                            <Button asChild className="w-full" variant="outline">
                                <a href={`/api/documents/${details.id}/download`}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Document
                                </a>
                            </Button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
