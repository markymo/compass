'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Loader2, X, Download, FileText, RefreshCw, Replace, Plus, Library, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import { getUploadIntentStatus } from '@/actions/upload-intent';
import { validateDocumentFile, ALLOWED_MIME_TYPES } from '@/lib/documents/upload-constants';
import { attachPartyDocument, replacePartyDocument, removePartyDocument, listPartyDocuments } from '@/actions/party-document-actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DocumentPicker, PickerMode } from '@/components/client/documents/DocumentPicker';
import { listLibraryDocumentsAction, DocumentPickerItem } from '@/actions/document-library-actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from 'date-fns';

interface PartyDocumentsSectionProps {
    clientLEId: string;
    partyId: string;
    disabled?: boolean;
    onCountLoaded?: (count: number) => void;
}

type OperationState = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'PROCESSING_DELAYED' | 'FAILED';

export function PartyDocumentsSection({ clientLEId, partyId, disabled, onCountLoaded }: PartyDocumentsSectionProps) {
    const [docs, setDocs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [opState, setOpState] = useState<OperationState>('IDLE');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
    const [opType, setOpType] = useState<'add' | 'replace' | null>(null);
    const [targetInstanceId, setTargetInstanceId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [removingInstanceId, setRemovingInstanceId] = useState<string | null>(null);
    const pollAttempts = useRef(0);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
    const [libraryDocs, setLibraryDocs] = useState<DocumentPickerItem[] | null>(null);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const result = await listPartyDocuments({ clientLEId, partyId });
            setDocs(result);
            onCountLoaded?.(result.length);
        } catch (e: any) {
            toast.error('Failed to load party documents');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [clientLEId, partyId]);

    // Bounded polling for upload intent
    useEffect(() => {
        if (!activeIntentId || (opState !== 'PROCESSING' && opState !== 'UPLOADING')) return;
        if (opState === 'UPLOADING') return;

        let timeoutId: NodeJS.Timeout;
        let isSubscribed = true;

        const poll = async () => {
            if (!isSubscribed) return;
            try {
                pollAttempts.current += 1;
                const res = await getUploadIntentStatus(activeIntentId);
                
                if (!isSubscribed) return;

                if (res.status === 'completed') {
                    try {
                        const idempotencyKey = crypto.randomUUID();
                        if (opType === 'replace' && targetInstanceId) {
                            await replacePartyDocument({
                                clientLEId,
                                partyId,
                                instanceId: targetInstanceId,
                                documentId: res.attachment.documentId,
                                idempotencyKey
                            });
                            toast.success('Document replaced successfully');
                        } else {
                            await attachPartyDocument({
                                clientLEId,
                                partyId,
                                documentId: res.attachment.documentId,
                                idempotencyKey
                            });
                            toast.success('Document attached successfully');
                        }
                        
                        resetState();
                        await loadDocuments();
                    } catch (actionErr: any) {
                        setOpState('FAILED');
                        setErrorMsg(actionErr.message || 'Failed to attach document to the party');
                    }
                } else if (res.status === 'failed') {
                    setOpState('FAILED');
                    setErrorMsg(res.message || 'Processing failed on the server');
                } else {
                    if (pollAttempts.current > 30) {
                        setOpState('PROCESSING_DELAYED');
                    } else {
                        timeoutId = setTimeout(poll, 2000);
                    }
                }
            } catch (e) {
                console.error("Failed to poll intent", e);
                if (isSubscribed) {
                    if (pollAttempts.current > 30) {
                        setOpState('PROCESSING_DELAYED');
                    } else {
                        timeoutId = setTimeout(poll, 2000);
                    }
                }
            }
        };
        
        poll();
        
        return () => {
            isSubscribed = false;
            clearTimeout(timeoutId);
        };
    }, [activeIntentId, opState, opType, targetInstanceId, clientLEId, partyId]);

    const resetState = () => {
        setOpState('IDLE');
        setUploadProgress(0);
        setActiveIntentId(null);
        setOpType(null);
        setTargetInstanceId(null);
        setErrorMsg(null);
        pollAttempts.current = 0;
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (replaceInputRef.current) replaceInputRef.current.value = '';
    };

    const openPicker = async (mode: PickerMode) => {
        setPickerMode(mode);
        setPickerOpen(true);
        setIsLoadingLibrary(true);
        setLibraryDocs(null);
        
        try {
            const docs = await listLibraryDocumentsAction(clientLEId);
            setLibraryDocs(docs);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load library documents');
            setPickerOpen(false);
            setPickerMode(null);
        } finally {
            setIsLoadingLibrary(false);
        }
    };

    const handleLibrarySelect = async (doc: DocumentPickerItem) => {
        if (!pickerMode) return;
        const mode = pickerMode;
        
        setPickerOpen(false);
        setPickerMode(null);
        setOpState('PROCESSING');
        setOpType(mode.type === 'ADD' ? 'add' : 'replace');
        setTargetInstanceId(mode.type === 'REPLACE' ? mode.instanceId : null);
        setErrorMsg(null);

        try {
            const idempotencyKey = crypto.randomUUID();
            if (mode.type === 'REPLACE') {
                await replacePartyDocument({
                    clientLEId,
                    partyId,
                    instanceId: mode.instanceId,
                    documentId: doc.id,
                    idempotencyKey
                });
                toast.success('Document replaced successfully');
            } else {
                await attachPartyDocument({
                    clientLEId,
                    partyId,
                    documentId: doc.id,
                    idempotencyKey
                });
                toast.success('Document attached successfully');
            }
            
            resetState();
            await loadDocuments();
        } catch (actionErr: any) {
            setOpState('FAILED');
            setErrorMsg(actionErr.message || 'Failed to attach document to the party');
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isReplace: boolean, instanceId?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateDocumentFile(file);
        if (validationError) {
            toast.error(validationError);
            e.target.value = '';
            return;
        }

        const newIntentId = crypto.randomUUID();
        const storagePathname = `private-documents/${clientLEId}/${newIntentId}/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        setOpState('UPLOADING');
        setUploadProgress(0);
        setOpType(isReplace ? 'replace' : 'add');
        setTargetInstanceId(instanceId || null);
        setActiveIntentId(newIntentId);
        setErrorMsg(null);
        pollAttempts.current = 0;

        try {
            await upload(storagePathname, file, {
                access: 'private',
                handleUploadUrl: '/api/documents/upload',
                clientPayload: JSON.stringify({ 
                    clientLEId, 
                    intentId: newIntentId,
                    mimeType: file.type
                }),
                onUploadProgress: (evt) => {
                    setUploadProgress(evt.percentage);
                }
            });
            setOpState('PROCESSING');
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast.error(error.message || 'Failed to upload document');
            resetState();
        }
    };

    const handleRemove = async (instanceId: string) => {
        if (disabled) return;
        setRemovingInstanceId(instanceId);
        try {
            await removePartyDocument({ 
                clientLEId, 
                partyId, 
                instanceId, 
                idempotencyKey: crypto.randomUUID() 
            });
            toast.success('Document removed');
            await loadDocuments();
        } catch (err: any) {
            toast.error(err.message || 'Failed to remove document');
        } finally {
            setRemovingInstanceId(null);
        }
    };

    function formatBytes(bytes: number) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    const isBusy = opState !== 'IDLE';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Documents</h3>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className={`w-3 h-3 animate-spin ${isLoading ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                </div>
                {!disabled && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isBusy}>
                                {isBusy ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working…</>
                                ) : (
                                    <><Plus className="w-4 h-4 mr-2" /> Add Document</>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload new file
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPicker({ type: 'ADD' })}>
                                <Library className="w-4 h-4 mr-2" />
                                Choose from library
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => handleFileSelect(e, false)}
                disabled={isBusy}
                accept={ALLOWED_MIME_TYPES.join(',')}
            />

            <input
                type="file"
                ref={replaceInputRef}
                className="hidden"
                onChange={(e) => handleFileSelect(e, true, targetInstanceId || undefined)}
                disabled={isBusy}
                accept={ALLOWED_MIME_TYPES.join(',')}
            />

            {errorMsg && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    Error: {errorMsg}
                </div>
            )}

            {isBusy && opType === 'add' && (
                <div className="border rounded-md p-3 bg-gray-50 flex items-center justify-center min-h-[60px]">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />
                    <span className="text-sm text-gray-600">
                        {opState === 'UPLOADING' ? `Uploading ${Math.round(uploadProgress)}%…` : 'Processing attachment…'}
                    </span>
                </div>
            )}

            <div className="space-y-2">
                {docs.length === 0 && !isLoading && !isBusy && (
                    <div className="text-sm text-gray-500 py-4 text-center border rounded-md border-dashed">
                        No documents attached.
                    </div>
                )}
                {docs.map(doc => (
                    <div key={doc.instanceId} className="flex items-center justify-between p-3 border rounded-md bg-white shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                    {doc.originalFilename}
                                </div>
                                <div className="text-xs text-gray-500 flex gap-2">
                                    <span>{formatBytes(doc.sizeBytes)}</span>
                                    <span>•</span>
                                    <span>Attached {formatDistanceToNow(new Date(doc.attachedAt), { addSuffix: true })}</span>
                                </div>
                            </div>
                        </div>

                        {!disabled && (
                            <div className="flex items-center gap-1 shrink-0 ml-4">
                                {isBusy && opType === 'replace' && targetInstanceId === doc.instanceId ? (
                                    <div className="px-3 py-1 flex items-center text-xs text-gray-500 bg-gray-100 rounded">
                                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                        {opState === 'UPLOADING' ? `Uploading ${Math.round(uploadProgress)}%` : 'Processing'}
                                    </div>
                                ) : (
                                    <>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500" disabled={isBusy || removingInstanceId === doc.instanceId}>
                                                    <Replace className="w-4 h-4 mr-1" />
                                                    Replace
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setTargetInstanceId(doc.instanceId);
                                                    replaceInputRef.current?.click();
                                                }}>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Upload new file
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openPicker({ type: 'REPLACE', instanceId: doc.instanceId })}>
                                                    <Library className="w-4 h-4 mr-2" />
                                                    Choose from library
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-red-600" disabled={isBusy || removingInstanceId === doc.instanceId}>
                                                    {removingInstanceId === doc.instanceId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove document?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will remove the document from this party. The document itself will remain in your library.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemove(doc.instanceId)} className="bg-red-600 hover:bg-red-700">
                                                        Remove
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <DocumentPicker 
                isOpen={pickerOpen}
                mode={pickerMode || { type: 'ADD' }}
                onClose={() => { setPickerOpen(false); setPickerMode(null); }}
                documents={libraryDocs || []}
                disabledDocumentIds={docs.map(d => d.documentId)}
                onSelect={handleLibrarySelect}
            />
        </div>
    );
}
