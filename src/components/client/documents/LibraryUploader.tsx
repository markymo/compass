'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { getUploadIntentStatus } from '@/actions/upload-intent';
import { validateDocumentFile, ALLOWED_MIME_TYPES } from '@/lib/documents/upload-constants';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface LibraryUploaderProps {
    clientLEId: string;
}

type UploadState = 'IDLE' | 'UPLOADING' | 'PROCESSING';

export function LibraryUploader({ clientLEId }: LibraryUploaderProps) {
    const [opState, setOpState] = useState<UploadState>('IDLE');
    const [progress, setProgress] = useState(0);
    const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
    const pollAttempts = useRef(0);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!activeIntentId || opState !== 'PROCESSING') return;

        let timeoutId: NodeJS.Timeout;
        let isSubscribed = true;

        const poll = async () => {
            if (!isSubscribed) return;
            try {
                pollAttempts.current += 1;
                const res = await getUploadIntentStatus(activeIntentId);
                
                if (!isSubscribed) return;

                if (res.status === 'completed') {
                    toast.success('Document uploaded successfully');
                    resetState();
                    router.refresh();
                } else if (res.status === 'failed') {
                    toast.error(res.message || 'Processing failed on the server');
                    resetState();
                } else {
                    // PENDING
                    if (pollAttempts.current > 30) {
                        toast.error('Upload processing timed out. Please check again later.');
                        resetState();
                    } else {
                        timeoutId = setTimeout(poll, 2000);
                    }
                }
            } catch (e) {
                console.error("Failed to poll intent", e);
                if (isSubscribed) {
                    if (pollAttempts.current > 30) {
                        toast.error('Upload processing timed out. Please check again later.');
                        resetState();
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
    }, [activeIntentId, opState, router]);

    const resetState = () => {
        setOpState('IDLE');
        setProgress(0);
        setActiveIntentId(null);
        pollAttempts.current = 0;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (opState !== 'IDLE') return;
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
        setProgress(0);
        setActiveIntentId(newIntentId);
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
                    setProgress(evt.percentage);
                }
            });

            setOpState('PROCESSING');
            
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast.error(error.message || 'Failed to upload document');
            resetState();
        }
    };

    const isBusy = opState !== 'IDLE';

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                disabled={isBusy}
                accept={ALLOWED_MIME_TYPES.join(',')}
            />
            <Button
                variant="default"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
            >
                {opState === 'IDLE' && (
                    <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Document
                    </>
                )}
                {opState === 'UPLOADING' && (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading {Math.round(progress)}%…
                    </>
                )}
                {opState === 'PROCESSING' && (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing…
                    </>
                )}
            </Button>
        </>
    );
}
