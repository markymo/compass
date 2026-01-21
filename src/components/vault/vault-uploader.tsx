"use client";

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { saveDocumentMetadata } from "@/actions/vault-actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, CheckCircle, File as FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VaultUploaderProps {
    clientLEId: string;
    onUploadComplete?: () => void;
}

export function VaultUploader({ clientLEId, onUploadComplete }: VaultUploaderProps) {
    const inputFileRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFile = async (file: File) => {
        if (!file) return;

        // 1. Client-side check (e.g. 50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            toast.error("File is too large (>50MB).");
            return;
        }

        setUploading(true);
        setProgress(10);

        try {
            // 2. Upload directly to Vercel Blob
            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/upload',
                // This ensures our API route authorizes the upload
            });

            setProgress(80);

            // 3. Save Metadata to DB
            const res = await saveDocumentMetadata(
                newBlob.url,
                file.name,
                file.size,
                file.type,
                clientLEId
            );

            if (res.success) {
                toast.success("File uploaded securely");
                setProgress(100);
                if (onUploadComplete) onUploadComplete();
            } else {
                toast.error("Failed to save file metadata");
            }

        } catch (error) {
            console.error(error);
            toast.error("Upload failed");
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full">
            <div
                className={cn(
                    "border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer",
                    isDragOver ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    uploading ? "opacity-50 pointer-events-none" : ""
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputFileRef.current?.click()}
            >
                <input
                    name="file"
                    ref={inputFileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Encrypting & Uploading...</p>
                        <Progress value={progress} className="h-2 w-full" />
                    </div>
                ) : (
                    <>
                        <div className="bg-indigo-50 p-3 rounded-full mb-4">
                            <UploadCloud className="h-6 w-6 text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 mb-1">
                            Click to upload or drag and drop
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                            Secure storage for PDF, documents, and images. <br />
                            Max file size 50MB.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
