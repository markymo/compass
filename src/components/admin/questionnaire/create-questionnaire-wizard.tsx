"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Sparkles, UploadCloud, FileText, FileType2, Search, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { getFIs } from "@/actions/questionnaire-library";
import { createManualQuestionnaire, generateAIQuestions, startBackgroundExtraction } from "@/actions/questionnaire";
import { uploadSourceDocument } from "@/actions/admin";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface WizardProps {
    sourceDocuments: any[];
}

export function CreateQuestionnaireWizard({ sourceDocuments }: WizardProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("upload");
    const router = useRouter();

    // -- Tab 1: Manual State --
    const [loadingManual, setLoadingManual] = useState(false);
    const [fis, setFis] = useState<any[]>([]);
    const [name, setName] = useState("");
    const [fiOrgId, setFiOrgId] = useState("");
    const [questions, setQuestions] = useState("");
    const [isGlobal, setIsGlobal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (open && fis.length === 0) {
            getFIs().then(res => setFis(res));
        }
    }, [open, fis.length]);

    const onManualSubmit = async () => {
        if (!name || !questions) {
            toast.error("Please fill in Name and Questions.");
            return;
        }

        setLoadingManual(true);
        const targetFiId = fiOrgId === "SYSTEM_INTERNAL_NONE" ? undefined : fiOrgId;
        const res = await createManualQuestionnaire({ name, fiOrgId: targetFiId || undefined, questions, isGlobal });
        setLoadingManual(false);

        if (res.success) {
            toast.success("Questionnaire created successfully.");
            setOpen(false);
            resetManualState();
            router.push(`/app/admin/questionnaires/${res.id}`);
        } else {
            toast.error(res.error || "Failed to create questionnaire.");
        }
    };

    const onGenerateAI = async () => {
        if (!aiPrompt) {
            toast.error("Please enter a prompt for the AI.");
            return;
        }

        setIsGenerating(true);
        const res = await generateAIQuestions(aiPrompt);
        setIsGenerating(false);

        if (res.success && res.questions) {
            setQuestions(res.questions.join("\n"));
            toast.success("Questions generated with AI!");
        } else {
            toast.error(res.error || "AI Generation failed.");
        }
    };

    const resetManualState = () => {
        setName("");
        setFiOrgId("");
        setQuestions("");
        setAiPrompt("");
        setIsGlobal(false);
    };

    // -- Tab 2: Upload State --
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processFile(file);
    };
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    };

    const triggerExtraction = async (id: string) => {
        // We don't await the full extraction here because it could take a while.
        // The startBackgroundExtraction action is async, we fire and navigate.
        setStatusMessage("Starting AI extraction...");
        startBackgroundExtraction(id).catch(e => console.error("Background extraction failed:", e));

        // Wait just a moment for the DB status to update to DIGITIZING
        setTimeout(() => {
            setOpen(false);
            router.push(`/app/admin/questionnaires/${id}`);
            resetUploadState();
        }, 1500);
    };

    const processFile = async (file: File) => {
        const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
        if (!validTypes.includes(file.type) && !file.name.endsWith(".docx") && !file.name.endsWith(".txt")) {
            setUploadStatus("error");
            setStatusMessage("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
            return;
        }

        setIsUploading(true);
        setUploadStatus("idle");
        setStatusMessage(`Creating record for ${file.name}...`);

        try {
            const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });

            const result = await uploadSourceDocument({
                name: file.name,
                type: file.type,
                fileUrl: blob.url,
                size: file.size
            });

            if (result.success && result.questionnaireId) {
                setUploadStatus("success");
                setStatusMessage(`Upload successful! Redirecting to extraction...`);
                await triggerExtraction(result.questionnaireId);
            } else {
                setUploadStatus("error");
                setStatusMessage(result.error || "Failed to save document record.");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadStatus("error");
            setStatusMessage("An unexpected error occurred during upload.");
        } finally {
            if (uploadStatus !== "success") {
                setIsUploading(false);
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const resetUploadState = () => {
        setIsUploading(false);
        setUploadStatus("idle");
        setStatusMessage("");
    };

    // -- Tab 3: Existing Document State --
    const [selectedSourceId, setSelectedSourceId] = useState<string>("");
    const [isExtractingExisting, setIsExtractingExisting] = useState(false);

    const onExtractExisting = async () => {
        if (!selectedSourceId) return;
        setIsExtractingExisting(true);
        triggerExtraction(selectedSourceId);
        // Reset handled in triggerExtraction
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
                resetUploadState();
                resetManualState();
                setIsExtractingExisting(false);
                setSelectedSourceId("");
            }
        }}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                    <Plus className="h-4 w-4" />
                    Create Questionnaire
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50">
                <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
                    <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        New Questionnaire Wizard
                    </DialogTitle>
                    <DialogDescription>
                        Choose how you want to create a structured mapping.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-200/50 shrink-0">
                            <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <UploadCloud className="h-4 w-4 mr-2" /> Upload File
                            </TabsTrigger>
                            <TabsTrigger value="existing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Search className="h-4 w-4 mr-2" /> Draft from Vault
                            </TabsTrigger>
                            <TabsTrigger value="manual" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <FileText className="h-4 w-4 mr-2" /> Start from Scratch
                            </TabsTrigger>
                        </TabsList>

                        {/* PATH 2: UPLOAD & EXTRACT */}
                        <TabsContent value="upload" className="flex-1 mt-0">
                            <div className="space-y-4">
                                <div className="text-center space-y-2 mb-6">
                                    <h3 className="text-lg font-medium text-slate-800">Upload & Extract with AI</h3>
                                    <p className="text-sm text-slate-500">Upload a raw document (PDF, Word, Text) and our AI will automatically structure it into actionable questionnaire items.</p>
                                </div>
                                <div
                                    className={cn(
                                        "border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer bg-white",
                                        isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
                                        isUploading && "pointer-events-none opacity-70 border-indigo-200"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                    />

                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        {isUploading ? (
                                            <div className="relative">
                                                <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-indigo-600">AI</span>
                                                </div>
                                            </div>
                                        ) : uploadStatus === "success" ? (
                                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                                        ) : uploadStatus === "error" ? (
                                            <AlertCircle className="h-12 w-12 text-red-500" />
                                        ) : (
                                            <div className="p-4 bg-indigo-50 rounded-full">
                                                <UploadCloud className="h-8 w-8 text-indigo-500" />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-lg text-slate-900">
                                                {isUploading ? "Processing Document..." : "Click or drag document to upload"}
                                            </h3>
                                            <p className="text-sm border-slate-500 max-w-sm mx-auto text-slate-500">
                                                {statusMessage || "Supported files: PDF, DOCX, TXT"}
                                            </p>
                                        </div>

                                        {!isUploading && uploadStatus === "idle" && (
                                            <Button variant="outline" type="button" className="mt-4 border-slate-300">
                                                Browse Files
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* PATH 3: EXISTING SOURCE */}
                        <TabsContent value="existing" className="flex-1 mt-0">
                            <div className="space-y-4 flex flex-col h-full">
                                <div className="text-center space-y-2 mb-2">
                                    <h3 className="text-lg font-medium text-slate-800">Draft from Uploaded Source</h3>
                                    <p className="text-sm text-slate-500">Run the AI extraction engine on a source document that has already been securely uploaded to the vault.</p>
                                </div>

                                <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-y-auto">
                                    {sourceDocuments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                            <Search className="h-8 w-8 mb-2 opacity-20" />
                                            <p>No source documents available.</p>
                                            <Button variant="link" onClick={() => setActiveTab("upload")}>Upload one first</Button>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {sourceDocuments.map(doc => (
                                                <div
                                                    key={doc.id}
                                                    onClick={() => !isExtractingExisting && setSelectedSourceId(doc.id)}
                                                    className={cn(
                                                        "p-4 flex items-center justify-between cursor-pointer transition-colors",
                                                        selectedSourceId === doc.id ? "bg-indigo-50" : "hover:bg-slate-50",
                                                        isExtractingExisting && "opacity-50 pointer-events-none"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("p-2 rounded-lg", selectedSourceId === doc.id ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                                                            <FileType2 className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <div className={cn("font-medium", selectedSourceId === doc.id ? "text-indigo-900" : "text-slate-900")}>
                                                                {doc.fileName}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                Uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                                            selectedSourceId === doc.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                                                        )}>
                                                            {selectedSourceId === doc.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex justify-end shrink-0">
                                    <Button
                                        onClick={onExtractExisting}
                                        disabled={!selectedSourceId || isExtractingExisting}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {isExtractingExisting ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                                        ) : (
                                            <>Extract with AI <Sparkles className="h-4 w-4 ml-2" /></>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* PATH 1: MANUAL */}
                        <TabsContent value="manual" className="flex-1 mt-0">
                            <div className="space-y-4 max-h-[500px] overflow-y-auto px-1 pb-4">
                                <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700">
                                        <Sparkles className="h-4 w-4" />
                                        <span className="text-sm font-semibold uppercase tracking-wider">AI Question Generator</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="aiPrompt" className="text-xs text-indigo-600">What should this questionnaire cover?</Label>
                                        <Textarea
                                            id="aiPrompt"
                                            placeholder="e.g. KYC questionnaire for a UK solar farm debt fund..."
                                            className="bg-white"
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                        size="sm"
                                        onClick={onGenerateAI}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                                        ) : (
                                            <><Sparkles className="h-4 w-4 mr-2" /> Generate Questions</>
                                        )}
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="fi">Financial Institution (Optional)</Label>
                                    <Select onValueChange={setFiOrgId} value={fiOrgId}>
                                        <SelectTrigger id="fi" className="bg-white">
                                            <SelectValue placeholder="Internal / System (Default)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SYSTEM_INTERNAL_NONE">Internal / System (Default)</SelectItem>
                                            {fis.map(fi => (
                                                <SelectItem key={fi.id} value={fi.id}>{fi.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Questionnaire Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Wolfsberg CBDDQ v1.5"
                                        className="bg-white"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center space-x-2 py-2">
                                    <Checkbox
                                        id="global"
                                        checked={isGlobal}
                                        onCheckedChange={(checked) => setIsGlobal(!!checked)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label
                                            htmlFor="global"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Global System Library
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Make this questionnaire available to all clients in the library.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="questions">Questions (One per line)</Label>
                                    <Textarea
                                        id="questions"
                                        placeholder="Enter each question on a new line..."
                                        className="min-h-[150px] bg-white resize-y"
                                        value={questions}
                                        onChange={(e) => setQuestions(e.target.value)}
                                    />
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <Button onClick={onManualSubmit} disabled={loadingManual} className="w-full sm:w-auto">
                                        {loadingManual && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Save Questionnaire
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
