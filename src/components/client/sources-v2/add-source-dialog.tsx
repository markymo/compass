"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, AlignLeft, Globe, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddSourceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leId: string;
}

export function AddSourceDialog({ open, onOpenChange, leId }: AddSourceDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"upload" | "text" | "web">("upload");

    const handleAdd = () => {
        setIsLoading(true);
        // Mock processing delay
        setTimeout(() => {
            toast.success("Source added to processing queue.");
            setIsLoading(false);
            onOpenChange(false);
        }, 1500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Add New Source</DialogTitle>
                    <DialogDescription>
                        Add a document, text, or web link to extract information and support compliance.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="upload" className="flex gap-2"><FileText className="h-4 w-4" /> Upload</TabsTrigger>
                        <TabsTrigger value="text" className="flex gap-2"><AlignLeft className="h-4 w-4" /> Text</TabsTrigger>
                        <TabsTrigger value="web" className="flex gap-2"><Globe className="h-4 w-4" /> Web URL</TabsTrigger>
                    </TabsList>

                    <div className="py-6 min-h-[200px]">
                        <TabsContent value="upload" className="mt-0">
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <UploadCloud className="h-6 w-6 text-slate-400 group-hover:text-indigo-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">Click to upload or drag and drop</h3>
                                <p className="text-xs text-slate-500 mt-1">PDF, DOCX, XLSX up to 50MB</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="text" className="mt-0 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="source-title">Title</Label>
                                <Input id="source-title" placeholder="e.g., Corporate Overview" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="source-text">Pasted Text</Label>
                                <Textarea
                                    id="source-text"
                                    placeholder="Paste the descriptive or evidentiary text here..."
                                    className="min-h-[150px]"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="web" className="mt-0 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="source-url">Secure Website URL</Label>
                                <Input id="source-url" placeholder="https://www.example.com/about-us" type="url" />
                                <p className="text-xs text-slate-500 mt-1">
                                    The system will attempt to securely scrape the text content from this page.
                                </p>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleAdd} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Source
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
