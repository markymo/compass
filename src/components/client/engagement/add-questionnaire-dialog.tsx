"use client"

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Search, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddQuestionnaireDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (type: 'library' | 'upload', data: any) => void;
}

export function AddQuestionnaireDialog({ open, onOpenChange, onAdd }: AddQuestionnaireDialogProps) {
    const [step, setStep] = useState<'selection' | 'library' | 'upload'>('selection');

    const reset = () => {
        setStep('selection');
        onOpenChange(false);
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
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder="Search library (e.g. Wolfsberg)..." className="pl-9" />
                        </div>
                        <div className="h-[200px] border rounded-md p-4 flex flex-col items-center justify-center text-slate-500 bg-slate-50 border-dashed">
                            <p>Library features coming next...</p>
                            <Button variant="link" onClick={() => setStep('selection')}>&larr; Back</Button>
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="space-y-4 py-4">
                        <div className="h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer">
                            <Upload className="h-8 w-8 mb-2 opacity-50" />
                            <p className="font-medium">Drag & drop your file here</p>
                            <p className="text-xs">PDF or DOCX up to 10MB</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <Button variant="ghost" onClick={() => setStep('selection')}>&larr; Back</Button>
                            <Button onClick={() => onAdd('upload', { file: 'mock' })}>Start Digitization</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
