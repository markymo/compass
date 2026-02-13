"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getFIs, createFI, saveFIMapping } from "@/actions/fi";
import { getMasterSchemaFields as getFields } from "@/actions/schema-utils";
import { Loader2, Check, AlertCircle, Plus, UploadCloud, FileText, ArrowRight, Save, LayoutGrid, File } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Server Actions
import { uploadAndExtractQuestionnaire } from "@/actions/questionnaire-ingest";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups"; // We need to expose this to client or fetch via action? 
// Actually FieldGroups is valid in client components if it's just a constant object.

// Types
type ProcessingStep = 'IDLE' | 'UPLOADING' | 'ANALYZING' | 'READY';

interface QuestionnaireItem {
    type: "question" | "section" | "instruction" | "note";
    text: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    category?: string;
    confidence?: number;
}

export default function MapperPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const questionnaireId = searchParams.get("questionnaireId"); // If editing existing

    // State: Selection
    const [fis, setFis] = useState<any[]>([]);
    const [selectedFi, setSelectedFi] = useState("");
    const [newFiName, setNewFiName] = useState("");

    // State: Processing
    const [status, setStatus] = useState<ProcessingStep>('IDLE');
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);

    // State: Data
    const [masterFields, setMasterFields] = useState<any[]>([]);
    const [extractedItems, setExtractedItems] = useState<QuestionnaireItem[]>([]);

    // Derived: Field Groups for Dropdown
    // We hardcode the import for now since it's a shared constant file
    const fieldGroups = Object.values(FIELD_GROUPS);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const [fiList, schemaFields] = await Promise.all([
            getFIs(),
            getFields()
        ]);
        setFis(fiList);
        setMasterFields(schemaFields);
    }

    async function handleCreateFI() {
        if (!newFiName) return;
        const res = await createFI(newFiName);
        if (res.success) {
            setFis([...fis, res.data]);
            setSelectedFi(res.data?.id || "");
            setNewFiName("");
            toast.success("Financial Institution created");
        }
    }

    // --- SMART INGESTION ---

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) setFile(droppedFile);
    }, []);

    async function handleProcess() {
        if (!file || !selectedFi) return;

        setStatus('UPLOADING');
        setProgress(10);

        try {
            const formData = new FormData();
            formData.append("file", file);

            // Artificial progress for UX
            const interval = setInterval(() => {
                setProgress(p => Math.min(p + 5, 90));
            }, 500);

            // CALL SERVER PIPELINE
            // Pass the ClientLE ID context. Wait, this page selects "FI" (Organization).
            // The mapping is usually done against an FI's "ClientLE" record or generic template?
            // "saveFIMapping" uses fiOrgId. 
            // The ingestion service expects a ClientLE ID for "DocumentRegistry".
            // Issue: We are in "Mapper Mode" (generic template), not "Link Mode" (specific client).
            // Solution: We should probably just pass the FI ID as a context reference, 
            // or if we strictly need a ClientLE, we might need a "Template Client" for the FI.
            // For now, let's assume 'selectedFi' finds a valid context or we adjust the server action to accept OrgId.
            // *Quick Fix*: The previous mapper didn't save files to registry. 
            // The new requirement wants Registry. Registry needs ClientLE. 
            // Let's pass the FI ID and let the server action handle it (maybe skipping registry if generic).
            // We'll cast selectedFi as string.

            const res = await uploadAndExtractQuestionnaire(formData, selectedFi);

            clearInterval(interval);
            setProgress(100);

            if (res.success) {
                setExtractedItems(res.structure as QuestionnaireItem[]);
                setStatus('READY');
                toast.success(`Extracted ${res.questionCount} items`);
            } else {
                setStatus('IDLE');
                toast.error(res.error || "Extraction failed");
            }

        } catch (e) {
            console.error(e);
            toast.error("Process failed");
            setStatus('IDLE');
        }
    }

    // --- MAPPING LOGIC ---

    function updateMapping(index: number, val: string) {
        const newItems = [...extractedItems];
        const item = newItems[index];

        if (val === "IGNORE") {
            item.masterFieldNo = null;
            item.masterQuestionGroupId = null;
        } else if (val.startsWith("GROUP:")) {
            item.masterQuestionGroupId = val.replace("GROUP:", "");
            item.masterFieldNo = null;
        } else if (val.startsWith("FIELD:")) {
            item.masterFieldNo = parseInt(val.replace("FIELD:", ""));
            item.masterQuestionGroupId = null;
        }

        setExtractedItems(newItems);
    }

    async function handleSave() {
        try {
            // Prepare Mapping for Persistence (FI Mapping or Questionnaire)
            // Existing 'saveFIMapping' expects { fiQuestion, masterKey }.
            // We need to translate our new structure to that format.
            // "masterKey" in the old system was string key. 
            // The NEW system wants fieldNo or groupId columns.

            // Since we are refactoring, we should probably update 'saveFIMapping' too.
            // BUT for this step, let's map back to keys if possible, OR
            // update the server action to accept structured mapping.

            // Let's assume we map to the existing "masterKey" string for now to keep it compatible with 'saveFIMapping',
            // UNLESS we want to refactor persistence now. 
            // Refactoring persistence is safer to ensure data integrity.

            // Let's create a new format payload:
            const items = extractedItems.filter(i => i.type === 'question' && (i.masterFieldNo || i.masterQuestionGroupId));

            const mappingPayload = items.map(i => ({
                fiQuestion: i.text,
                masterFieldNo: i.masterFieldNo,
                masterQuestionGroupId: i.masterQuestionGroupId
            }));

            // We need a NEW action for this new robust mapping
            // import { saveRobustMapping } from "@/actions/fi"; // TODO: Create this?
            // For now, let's use the existing one but we might need to modify it.

            // Wait, the user plan said "Phase 4.2 Update saveFIMapping".
            // I will implement the UI assuming the action exists or I will update it next.
            // Let's proceed with UI.

            await saveFIMapping(selectedFi, mappingPayload as any); // Temporary cast
            toast.success("Mappings Saved");
            setStatus('IDLE');
            setExtractedItems([]);
            setFile(null);

        } catch (e) {
            toast.error("Failed to save");
        }
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                        Smart Ingestion pipeline
                    </h1>
                    <p className="text-slate-500">Upload questionnaires to automatically map them to the Master Schema.</p>
                </div>
                {questionnaireId && (
                    <Button variant="outline" onClick={() => router.back()}>Exit</Button>
                )}
            </div>

            {/* STEP 1: CONFIGURATION */}
            {status === 'IDLE' && (
                <div className="grid gap-6 md:grid-cols-12">
                    {/* ... Selection Logic ... */}
                    <Card className="md:col-span-4 h-fit">
                        <CardHeader>
                            <CardTitle>1. Target Organization</CardTitle>
                            <CardDescription>Select the Financial Institution</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Financial Institution</Label>
                                <Select value={selectedFi} onValueChange={setSelectedFi}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select FI..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fis.map(fi => (
                                            <SelectItem key={fi.id} value={fi.id}>{fi.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">Or Create New</span></div>
                            </div>
                            <div className="flex gap-2">
                                <Input placeholder="New Name..." value={newFiName} onChange={e => setNewFiName(e.target.value)} />
                                <Button size="sm" onClick={handleCreateFI}>Add</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-8">
                        <CardHeader>
                            <CardTitle>2. Upload Document</CardTitle>
                            <CardDescription>PDF, Word, or Excel. Scanned documents supported.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:bg-slate-50",
                                    file ? "border-indigo-500 bg-indigo-50/50" : "border-slate-300"
                                )}
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleFileDrop}
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                <input type="file" id="file-upload" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />

                                {file ? (
                                    <div className="flex flex-col items-center">
                                        <FileText className="h-12 w-12 text-indigo-600 mb-4" />
                                        <p className="font-medium text-lg text-indigo-900">{file.name}</p>
                                        <p className="text-sm text-indigo-600">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="bg-slate-100 p-4 rounded-full mb-4">
                                            <UploadCloud className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <p className="font-medium text-slate-900">Click to upload or drag and drop</p>
                                        <p className="text-sm text-slate-500 mt-1">PDF, DOCX, XLSX, Images</p>
                                    </div>
                                )}
                            </div>

                            <Button
                                className="w-full mt-6"
                                size="lg"
                                disabled={!file || !selectedFi}
                                onClick={handleProcess}
                            >
                                Start Ingestion
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* STEP 2: PROCESSING */}
            {(status === 'UPLOADING' || status === 'ANALYZING') && (
                <Card className="max-w-md mx-auto mt-20 text-center p-12">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-6" />
                    <h2 className="text-xl font-semibold mb-2">Processing Document</h2>
                    <p className="text-slate-500 mb-6">Using AI to analyze structure and suggest mappings...</p>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                        <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400">{status === 'UPLOADING' ? 'Uploading & Ingesting...' : 'AI Extraction...'}</p>
                </Card>
            )}

            {/* STEP 3: SMART MAPPING */}
            {status === 'READY' && (
                <div className="grid gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Review Extraction & Mapping</CardTitle>
                                <CardDescription>Confirm the AI's suggestions. Prioritize <strong>Field Groups</strong> for best results.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStatus('IDLE')}>Start Over</Button>
                                <Button onClick={handleSave}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Confirm & Save
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">Question / Requirement</TableHead>
                                        <TableHead className="w-[40%]">ONPro Master Mapping</TableHead>
                                        <TableHead className="w-[10%]">Confidence</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {extractedItems.map((item, idx) => {
                                        if (item.type === 'section') {
                                            return (
                                                <TableRow key={idx} className="bg-slate-50">
                                                    <TableCell colSpan={3} className="font-bold text-slate-700 py-4">
                                                        {item.text}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="align-top">
                                                    <div className="text-sm font-medium">{item.text}</div>
                                                    {item.type === 'instruction' && <Badge variant="outline" className="mt-1 text-[10px]">Instruction</Badge>}
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <Select
                                                        value={
                                                            item.masterQuestionGroupId
                                                                ? `GROUP:${item.masterQuestionGroupId}`
                                                                : item.masterFieldNo
                                                                    ? `FIELD:${item.masterFieldNo}`
                                                                    : "IGNORE"
                                                        }
                                                        onValueChange={(val) => updateMapping(idx, val)}
                                                    >
                                                        <SelectTrigger className={cn(
                                                            "w-full",
                                                            item.masterQuestionGroupId && "font-semibold text-indigo-700 bg-indigo-50 border-indigo-200",
                                                            !item.masterFieldNo && !item.masterQuestionGroupId && "text-slate-400"
                                                        )}>
                                                            <SelectValue placeholder="Select Mapping..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-[300px]">
                                                            <SelectItem value="IGNORE">-- Ignore --</SelectItem>

                                                            <SelectGroup>
                                                                <SelectLabel className="text-indigo-600 font-bold flex items-center gap-1">
                                                                    <LayoutGrid className="w-3 h-3" /> Field Groups (Recommended)
                                                                </SelectLabel>
                                                                {fieldGroups.map(g => (
                                                                    <SelectItem key={g.id} value={`GROUP:${g.id}`} className="font-medium">
                                                                        📦 {g.label} <span className="text-xs text-slate-400 font-normal ml-1">({g.fieldNos.length} fields)</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectGroup>

                                                            <SelectGroup>
                                                                <SelectLabel className="flex items-center gap-1">
                                                                    <File className="w-3 h-3" /> Atomic Fields
                                                                </SelectLabel>
                                                                {masterFields.map((f, i) => {
                                                                    // Fallback to key or index if fieldNo is missing
                                                                    const fId = f.fieldNo || (f.key ? parseInt(f.key) : null);
                                                                    if (!fId) return null;
                                                                    return (
                                                                        <SelectItem key={`field-${fId}-${i}`} value={`FIELD:${fId}`}>
                                                                            📄 {f.label} <span className="text-xs text-slate-400 ml-1">#{fId}</span>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectGroup>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    {item.confidence && (
                                                        <Badge variant={item.confidence > 0.8 ? "default" : "secondary"}>
                                                            {(item.confidence * 100).toFixed(0)}%
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
