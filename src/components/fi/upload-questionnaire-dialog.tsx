"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { createQuestionnaire, startBackgroundExtraction } from "@/actions/questionnaire";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function UploadQuestionnaireDialog({ isAdmin, children }: { isAdmin?: boolean, children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const router = useRouter();

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        // If file was dropped but not in input, append it
        if (selectedFile && !formData.get("file")) {
            formData.set("file", selectedFile);
        } else if (!formData.get("file")) {
            // Fallback if input was used directly
            const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput?.files?.[0]) {
                formData.set("file", fileInput.files[0]);
            }
        }

        const file = formData.get("file") as File;
        if (!file || file.size === 0) {
            setLoading(false);
            alert("Please select a file.");
            return;
        }

        // 1. Create Record (Status: DIGITIZING)
        const res = await createQuestionnaire(null, formData);

        if (res.success && res.data?.id) {
            const qId = res.data.id;

            // 2. Close & Reset UI
            setLoading(false);
            setOpen(false);
            setSelectedFile(null);

            // If Admin, they probably want to go map it immediately, so we redirect
            // If FI, they might want to just see it in the list "Digitizing..."
            if (isAdmin) {
                toast.success("Upload successful. Redirecting to editor...");
                router.push(`/app/admin/questionnaires/${qId}`);
                // Admin page will handle auto-extract on load as before? 
                // Wait, if it's DIGITIZING, the admin page might show status.
                // Actually, let's trigger it in background anyway for consistency, 
                // OR let the admin page load trigger it.
                // Let's redirect for Admin.
            } else {
                toast.info("Upload started. Processing in background...");
                router.refresh();

                // 3. Trigger Async Extraction (FI only)
                try {
                    const extRes = await startBackgroundExtraction(qId);
                    if (extRes.success) {
                        toast.success("Digitization complete!");
                    } else {
                        toast.error("Digitization failed.");
                    }
                    router.refresh();
                } catch (e) { console.error(e); }
            }
        } else {
            setLoading(false);
            alert("Failed to upload: " + (res.error || "Unknown error"));
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children ? children : (
                    <Button>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload New
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Upload Questionnaire</DialogTitle>
                        <DialogDescription>
                            Upload a new DOCX or PDF questionnaire. System Admins will review and map it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Questionnaire Name</Label>
                            <Input id="name" name="name" placeholder="e.g. US Institutional Onboarding" required />
                        </div>

                        <div className="grid gap-2">
                            <Label>Document File</Label>
                            <div
                                className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:bg-slate-50"
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <Input
                                    id="file"
                                    name="file"
                                    type="file"
                                    accept=".pdf,.docx,.doc"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleChange}
                                />

                                {selectedFile ? (
                                    <div className="flex flex-col items-center text-center p-4">
                                        <div className="bg-indigo-100 p-2 rounded-full mb-2">
                                            <Upload className="w-6 h-6 text-indigo-600" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                                        <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center p-4">
                                        <Upload className={`w-8 h-8 mb-2 ${dragActive ? "text-indigo-500" : "text-slate-400"}`} />
                                        <p className="text-sm text-slate-600 font-medium">
                                            <span className="text-indigo-600 hover:underline">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">PDF, DOCX or DOC (MAX. 10MB)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading || !selectedFile}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Upload
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
