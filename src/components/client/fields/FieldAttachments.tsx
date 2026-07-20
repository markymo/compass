'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ResolvedAttachment } from '@/lib/master-data/field-display-model';
import { cn } from '@/lib/utils';
import { Paperclip, Loader2, X, Download, FileText, RefreshCw, AlertCircle, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { upload } from '@vercel/blob/client';
import { addFieldAttachment, removeFieldAttachment, replaceFieldAttachment } from '@/actions/attachment-actions';
import { getUploadIntentStatus } from '@/actions/upload-intent';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, validateDocumentFile } from '@/lib/documents/upload-constants';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Library, Upload } from 'lucide-react';
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

export interface FieldAttachmentsProps {
    clientLEId: string;
    fieldNo: number;
    attachments: ResolvedAttachment[];
    isEditable?: boolean;
    mode?: 'manage' | 'read-only' | 'indicator';
    className?: string;
    onChange?: () => void;
}

// Shared constants are imported from upload-constants.ts

type OperationState = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'PROCESSING_DELAYED' | 'FAILED';

export function FieldAttachments({ clientLEId, fieldNo, attachments, isEditable, mode = 'manage', className, onChange }: FieldAttachmentsProps) {
    const [opState, setOpState] = useState<OperationState>('IDLE');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
    const [opType, setOpType] = useState<'add' | 'replace' | null>(null);
    const [targetInstanceId, setTargetInstanceId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [removingInstanceId, setRemovingInstanceId] = useState<string | null>(null);
    const pollAttempts = useRef(0);
    const router = useRouter();

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
    const [libraryDocs, setLibraryDocs] = useState<DocumentPickerItem[] | null>(null);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    // Bounded polling
    useEffect(() => {
        if (!activeIntentId || (opState !== 'PROCESSING' && opState !== 'UPLOADING')) return;

        // Don't poll while uploading (binary transfer), wait until PROCESSING
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
                    // Document is ready in Vercel Blob and the intent is completed.
                    // Now perform the actual attachment claim mutation.
                    try {
                        const idempotencyKey = crypto.randomUUID();
                        if (opType === 'replace' && targetInstanceId) {
                            await replaceFieldAttachment({
                                clientLEId,
                                fieldNo,
                                instanceId: targetInstanceId,
                                attachmentDocumentId: res.attachment.documentId,
                                idempotencyKey
                            });
                            toast.success('Attachment replaced successfully');
                        } else {
                            await addFieldAttachment({
                                clientLEId,
                                fieldNo,
                                attachmentDocumentId: res.attachment.documentId,
                                idempotencyKey
                            });
                            toast.success('Document attached successfully');
                        }
                        
                        resetState();
                        router.refresh();
                        onChange?.();
                    } catch (actionErr: any) {
                        setOpState('FAILED');
                        setErrorMsg(actionErr.message || 'Failed to attach document to the field');
                    }
                } else if (res.status === 'failed') {
                    setOpState('FAILED');
                    setErrorMsg(res.message || 'Processing failed on the server');
                } else {
                    // PENDING
                    if (pollAttempts.current > 30) {
                        // Approx 45-60s elapsed
                        setOpState('PROCESSING_DELAYED');
                    } else {
                        // Exponential-ish backoff or fixed. Let's use 2000ms.
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
    }, [activeIntentId, opState, opType, targetInstanceId, clientLEId, fieldNo, router, onChange]);

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
                await replaceFieldAttachment({
                    clientLEId,
                    fieldNo,
                    instanceId: mode.instanceId,
                    attachmentDocumentId: doc.id,
                    idempotencyKey
                });
                toast.success('Attachment replaced successfully');
            } else {
                await addFieldAttachment({
                    clientLEId,
                    fieldNo,
                    attachmentDocumentId: doc.id,
                    idempotencyKey
                });
                toast.success('Document attached successfully');
            }
            
            resetState();
            router.refresh();
            onChange?.();
        } catch (actionErr: any) {
            setOpState('FAILED');
            setErrorMsg(actionErr.message || 'Failed to attach document to the field');
        }
    };

    // Validation delegated to validateDocumentFile

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
        
        // Vercel Blob client requires the pathname to be passed from the client; 
        // the server cannot override it during token generation.
        // We construct a secure, unique path here that the server will validate.
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
                access: 'private', // Must match the access level granted by onBeforeGenerateToken
                handleUploadUrl: '/api/documents/upload',
                clientPayload: JSON.stringify({ 
                    clientLEId, 
                    fieldNo,
                    intentId: newIntentId,
                    mimeType: file.type
                }),
                onUploadProgress: (evt) => {
                    setUploadProgress(evt.percentage);
                }
            });

            // Binary upload is done, switch to processing mode for polling
            setOpState('PROCESSING');
            
        } catch (error: any) {
            console.error('Upload failed:', error);
            setOpState('FAILED');
            setErrorMsg(error.message || 'Failed to upload document');
        } finally {
            e.target.value = '';
        }
    };

    const handleManualRetry = () => {
        if (activeIntentId) {
            setOpState('PROCESSING');
            pollAttempts.current = 0; // reset attempts to give it another full window
        }
    };

    const handleRemove = async (instanceId: string) => {
        setRemovingInstanceId(instanceId);
        try {
            await removeFieldAttachment({ clientLEId, fieldNo, instanceId, idempotencyKey: crypto.randomUUID() });
            toast.success('Attachment removed');
            router.refresh();
            onChange?.();
        } catch (error) {
            console.error('Failed to remove attachment:', error);
            toast.error('Failed to remove attachment');
        } finally {
            setRemovingInstanceId(null);
        }
    };

    if (!attachments?.length && (!isEditable || mode !== 'manage')) return null;

    if (mode === 'indicator') {
        if (!attachments?.length) return null;
        return (
            <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600", className)} title={`${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`}>
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span>{attachments.length}</span>
            </div>
        );
    }

    const isBusy = opState === 'UPLOADING' || opState === 'PROCESSING' || removingInstanceId !== null;

    return (
        <div className={`mt-2 flex flex-col gap-2 ${className || ''}`}>
            {attachments.map(att => {
                const fieldProv = att.provenance.find(p => p.type === 'FIELD') as Extract<typeof att.provenance[0], {type: 'FIELD'}> | undefined;
                const fieldInstanceId = fieldProv?.fieldAttachmentInstanceId;
                
                const isReplacingThis = opType === 'replace' && targetInstanceId === fieldInstanceId;
                const isRemovingThis = removingInstanceId === fieldInstanceId;
                const showRowState = isReplacingThis && opState !== 'IDLE';

                return (
                    <div key={att.documentId} className="flex flex-col border rounded-md bg-white overflow-hidden">
                        <div className="flex items-center justify-between p-2 text-sm">
                            <div className="flex flex-col gap-1 overflow-hidden" title={att.displayName || 'Document'}>
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="truncate font-medium text-slate-700">{att.displayName}</span>
                                    {att.sizeBytes && (
                                        <span className="text-xs text-slate-400 shrink-0">
                                            {Math.round(parseInt(att.sizeBytes, 10) / 1024)} KB
                                        </span>
                                    )}
                                </div>
                                {att.provenance.map((prov, i) => (
                                    <div key={i} className="flex items-center gap-1 text-[10px] text-slate-500 pl-6">
                                        {prov.type === 'PARTY' ? (
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Attached to Party: {prov.partyName}</span>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                <a 
                                    href={`/api/documents/${att.documentId}/download`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className={cn("p-1 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded", isBusy && "opacity-50 pointer-events-none")}
                                    title="Download"
                                >
                                    <Download className="w-4 h-4" />
                                </a>

                                {isEditable && mode === 'manage' && fieldInstanceId && (
                                    <>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-slate-400 hover:text-blue-600 focus:ring-blue-500"
                                                    title="Replace attachment"
                                                    disabled={isBusy}
                                                >
                                                    {isLoadingLibrary && opType === 'replace' && targetInstanceId === fieldInstanceId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
                                                    <span className="sr-only">Replace attachment</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => {
                                                    setTargetInstanceId(fieldInstanceId!);
                                                    replaceInputRef.current?.click();
                                                }}>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Upload Document
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => {
                                                    openPicker({ type: 'REPLACE', instanceId: fieldInstanceId! });
                                                }}>
                                                    <Library className="w-4 h-4 mr-2" />
                                                    Choose from Library
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button 
                                                    className={cn("p-1 text-slate-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded", isBusy && "opacity-50 pointer-events-none")}
                                                    title="Remove attachment"
                                                    disabled={isBusy}
                                                    aria-label="Remove attachment"
                                                >
                                                    {isRemovingThis ? <Loader2 className="w-4 h-4 animate-spin text-red-600" /> : <X className="w-4 h-4" />}
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove attachment</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Remove this attachment from the field? The document will remain in OnPro and the previous attachment history will be retained.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isRemovingThis}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleRemove(fieldInstanceId!);
                                                        }}
                                                        disabled={isRemovingThis}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        {isRemovingThis ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                        Remove
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Row-level Progress / Error State for Replace */}
                        {showRowState && (
                            <div className="bg-slate-50 border-t px-3 py-2 flex items-center justify-between" role="status" aria-live="polite">
                                <div className="flex items-center gap-2 text-xs">
                                    {opState === 'UPLOADING' && (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                            <span className="text-slate-600">Uploading new document {Math.round(uploadProgress)}%</span>
                                        </>
                                    )}
                                    {opState === 'PROCESSING' && (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                            <span className="text-slate-600">Upload complete. OnPro is processing...</span>
                                        </>
                                    )}
                                    {opState === 'PROCESSING_DELAYED' && (
                                        <>
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-slate-600">OnPro is still processing this upload. You can check again.</span>
                                        </>
                                    )}
                                    {opState === 'FAILED' && (
                                        <>
                                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                            <span className="text-red-600">{errorMsg || 'Failed to replace attachment'}</span>
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex gap-2">
                                    {opState === 'PROCESSING_DELAYED' && (
                                        <Button variant="outline" size="sm" onClick={handleManualRetry} className="h-6 text-[10px]">
                                            <RefreshCw className="w-3 h-3 mr-1" />
                                            Retry status check
                                        </Button>
                                    )}
                                    {(opState === 'FAILED' || opState === 'PROCESSING_DELAYED') && (
                                        <Button variant="ghost" size="sm" onClick={resetState} className="h-6 text-[10px]">
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {isEditable && mode === 'manage' && (
                <div className="mt-1 flex flex-col items-start gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        id={`file-upload-${fieldNo}`}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, false)}
                        disabled={isBusy}
                        accept={ALLOWED_MIME_TYPES.join(',')}
                    />
                    
                    {/* Hidden input strictly for Replace flow */}
                    <input
                        type="file"
                        ref={replaceInputRef}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, true, targetInstanceId!)}
                        disabled={isBusy}
                        accept={ALLOWED_MIME_TYPES.join(',')}
                    />
                    
                    {opType !== 'replace' && (
                        <div className="flex flex-col gap-2 w-full">
                            

                            {/* Inline State for Add */}
                            {opType === 'add' && opState !== 'IDLE' && (
                                <div className="bg-slate-50 border rounded px-3 py-2 flex flex-wrap items-center justify-between gap-2" role="status" aria-live="polite">
                                    <div className="flex items-center gap-2 text-xs">
                                        {opState === 'UPLOADING' && (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                                <span className="text-slate-600">Uploading {Math.round(uploadProgress)}%</span>
                                            </>
                                        )}
                                        {isLoadingLibrary && (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                                <span className="text-slate-600">Loading documents...</span>
                                            </>
                                        )}
                                        {opState === 'PROCESSING' && !isLoadingLibrary && (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                                <span className="text-slate-600">OnPro is processing...</span>
                                            </>
                                        )}
                                        {opState === 'PROCESSING_DELAYED' && (
                                            <>
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-slate-600">OnPro is still processing this upload.</span>
                                            </>
                                        )}
                                        {opState === 'FAILED' && (
                                            <>
                                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                <span className="text-red-600">{errorMsg || 'Failed to attach document'}</span>
                                            </>
                                        )}
                                    </div>
                                    
                                    <div className="flex gap-2 shrink-0">
                                        {opState === 'PROCESSING_DELAYED' && (
                                            <Button variant="outline" size="sm" onClick={handleManualRetry} className="h-6 text-[10px]">
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                Retry status check
                                            </Button>
                                        )}
                                        {(opState === 'FAILED' || opState === 'PROCESSING_DELAYED') && (
                                            <Button variant="ghost" size="sm" onClick={resetState} className="h-6 text-[10px]">
                                                Clear
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {opState === 'IDLE' && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5 text-xs font-medium text-slate-600 border-dashed w-full sm:w-auto"
                                            disabled={isBusy}
                                        >
                                            <span>
                                                {isLoadingLibrary && opType === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                                                {isLoadingLibrary && opType === 'add' ? 'Loading...' : 'Add attachment'}
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload Document
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => {
                                            openPicker({ type: 'ADD' });
                                        }}>
                                            <Library className="w-4 h-4 mr-2" />
                                            Choose from Library
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {opState === 'IDLE' && (
                                <p className="text-[10px] text-slate-400">
                                    PDF, Office documents, CSV, TXT, JPG or PNG. Maximum 20 MB.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {pickerOpen && pickerMode && libraryDocs && (
                <DocumentPicker
                    isOpen={pickerOpen}
                    onClose={() => { setPickerOpen(false); setPickerMode(null); }}
                    documents={libraryDocs}
                    onSelect={handleLibrarySelect}
                    disabledDocumentIds={attachments.map(a => a.documentId)}
                    mode={pickerMode}
                />
            )}
        </div>
    );
}
