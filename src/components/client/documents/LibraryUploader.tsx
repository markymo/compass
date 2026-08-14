'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Plus } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { getUploadIntentStatus } from '@/actions/upload-intent';
import { validateDocumentFile, ALLOWED_MIME_TYPES } from '@/lib/documents/upload-constants';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { StandardTooltip } from '@/components/ui/standard-tooltip';

export interface LibraryUploaderProps {
    clientLEId: string;
    iconOnly?: boolean;
}

type UploadState = 'IDLE' | 'UPLOADING' | 'PROCESSING';

export function LibraryUploader({ clientLEId, iconOnly = false }: LibraryUploaderProps) {
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
            if (timeoutId) clearTimeout(timeoutId);
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
            return;
        }

        try {
            setOpState('UPLOADING');
            setProgress(0);

            const blob: any = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: `/api/documents/upload-intent?clientLEId=${clientLEId}`,
                onUploadProgress: (progressEvent) => {
                    setProgress(progressEvent.percentage);
                },
            });

            setOpState('PROCESSING');
            if (blob?.clientPayload) {
                try {
                    const parsed = JSON.parse(blob.clientPayload);
                    if (parsed.intentId) {
                        setActiveIntentId(parsed.intentId);
                    } else {
                        toast.error('Upload response missing tracking details');
                        resetState();
                    }
                } catch {
                    toast.error('Malformed payload received from upload handler');
                    resetState();
                }
            } else {
                toast.error('Upload response missing payload');
                resetState();
            }
        } catch (err: any) {
            console.error("Upload error", err);
            toast.error(err.message || 'Failed to upload document');
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
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
                {opState === 'IDLE' && (
                    <>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                    </>
                )}
                {opState === 'UPLOADING' && (
                    <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Uploading {Math.round(progress)}%…
                    </>
                )}
                {opState === 'PROCESSING' && (
                    <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing…
                    </>
                )}
            </Button>
        </>
    );
}
