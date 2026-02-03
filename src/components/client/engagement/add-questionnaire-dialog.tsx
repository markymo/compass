"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Search, BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuestionnaire, startBackgroundExtraction } from "@/actions/questionnaire";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AddQuestionnaireDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (type: 'library', data: any) => void;
    engagementId: string;
}

export function AddQuestionnaireDialog({ open, onOpenChange, onAdd, engagementId }: AddQuestionnaireDialogProps) {
    const [step, setStep] = useState<'selection' | 'library' | 'upload'>('selection');
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const router = useRouter();

    const reset = () => {
        setStep('selection');
        setSelectedFile(null);
        setLoading(false);
        onOpenChange(false);
    };

    // Drag & Drop Handlers
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUploadSubmit = async () => {
        if (!selectedFile) return;
        setLoading(true);

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("name", selectedFile.name.replace(/\.[^/.]+$/, "")); // Default name to filename
        if (engagementId) {
            formData.append("fiEngagementId", engagementId);
        }

        // 1. Create Record (Fast)
        // Pass null as identifier so it infers from engagementId in formData
        const res = await createQuestionnaire(null, formData);

        if (res.success && res.data) {
            const qId = res.data.id;

            // 2. Update UI (Show "Digitizing" row) & Close Modal
            toast.info("Upload started. Digitizing in background...");
            router.refresh();
            reset();

            // 3. Trigger Async Extraction
            try {
                const extRes = await startBackgroundExtraction(qId);
                if (extRes.success) {
                    toast.success("Digitization complete!");
                } else if (extRes.error === "SCANNED_PDF_DETECTED") {
                    toast.error("Scanned PDF detected. Please upload a digital PDF (text-selectable) or Word document.");
                } else {
                    toast.error("Digitization failed. Please try manual entry.");
                }
                router.refresh(); // Update row status
            } catch (e) {
                console.error(e);
            }
        } else {
            setLoading(false);
            alert("Upload failed: " + res.error);
        }
    };


    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) reset(); else onOpenChange(val); }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add Questionnaire</DialogTitle>
                    <DialogDescription>
                        Select a standard questionnaire or digitize a new document.
                    </DialogDescription>
                </DialogHeader>

                {step === 'selection' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <Card className="cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group" onClick={() => setStep('library')}>
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Standard Library</h3>
                                    <p className="text-sm text-slate-500 mt-1">Choose from industry standard forms (Wolfsberg, SIG, etc.)</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all group" onClick={() => setStep('upload')}>
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Digitize Custom Doc</h3>
                                    <p className="text-sm text-slate-500 mt-1">Upload a PDF or Word doc and we'll extract the questions.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {step === 'library' && (
                    <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder="Search library (e.g. Wolfsberg)..." className="pl-9" />
                        </div>
                        <div className="grid gap-2">
                            {[
                                { id: 'wolfsberg', name: 'Wolfsberg CBDDQ v1.4', desc: 'Standard Correspondent Banking Due Diligence' },
                                { id: 'sig', name: 'SIG Lite 2024', desc: 'Standard Information Gathering - Lite' },
                                { id: 'custom', name: 'JPM Custom Onboarding', desc: 'Specific requirements for J.P. Morgan' }
                            ].map(t => (
                                <div key={t.id} className="p-3 border rounded-lg hover:border-indigo-500 cursor-pointer flex justify-between items-center group"
                                    onClick={() => onAdd('library', { templateId: t.id, name: t.name })}
                                >
                                    <div>
                                        <h4 className="font-medium text-slate-900 group-hover:text-indigo-700">{t.name}</h4>
                                        <p className="text-xs text-slate-500">{t.desc}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100">Select</Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="link" onClick={() => setStep('selection')}>&larr; Back</Button>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="space-y-6 py-6">
                        <div className="grid gap-2">
                            <Label>Document File</Label>
                            <div
                                className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:bg-slate-50"
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <Input
                                    type="file"
                                    accept=".pdf,.docx,.doc"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />

                                {selectedFile ? (
                                    <div className="flex flex-col items-center text-center p-4 animate-in fade-in">
                                        <div className="bg-emerald-100 p-3 rounded-full mb-3">
                                            <FileText className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900 truncate max-w-[250px]">{selectedFile.name}</p>
                                        <p className="text-xs text-slate-500 mb-2">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-500 hover:text-red-700 h-8">Remove</Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center p-4">
                                        <Upload className={`w-10 h-10 mb-3 ${dragActive ? "text-indigo-500" : "text-slate-400"}`} />
                                        <p className="text-sm text-slate-600 font-medium">
                                            <span className="text-indigo-600 hover:underline">Click to browse</span> or drag file here
                                        </p>
                                        <p className="text-xs text-slate-400 mt-2">PDF or DOCX (MAX. 10MB)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <Button variant="ghost" onClick={() => setStep('selection')}>&larr; Back</Button>
                            <Button onClick={handleUploadSubmit} disabled={!selectedFile || loading} className="min-w-[140px]">
                                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Start Digitization"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
