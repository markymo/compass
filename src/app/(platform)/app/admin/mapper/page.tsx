"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { parseDocument, generateMappingSuggestions, MappingSuggestion } from "@/actions/ai-mapper";
import { getFIs, createFI, saveFIMapping } from "@/actions/fi";
import { appendFieldsToActiveSchema } from "@/actions/schema"; // Import append action
import { getMasterSchemaFields as getFields } from "@/actions/schema-utils"; // Distinction
import { Loader2, Check, AlertCircle, Plus } from "lucide-react";

// ... (imports)
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { analyzeQuestionnaire, saveQuestionnaireChanges } from "@/actions/questionnaire";

export default function MapperPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const questionnaireId = searchParams.get("questionnaireId");

    const [fis, setFis] = useState<any[]>([]);
    const [selectedFi, setSelectedFi] = useState("");
    const [newFiName, setNewFiName] = useState("");

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Select/Upload, 2: Review

    const [masterFields, setMasterFields] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);

    // Questionnaire Context
    const [qContext, setQContext] = useState<{ name: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Auto-analyze if questionnaireId is present
    useEffect(() => {
        if (questionnaireId && masterFields.length > 0) {
            handleAnalyzeQuestionnaire(questionnaireId);
        }
    }, [questionnaireId, masterFields]);

    async function loadData() {
        const [fiList, schemaFields] = await Promise.all([
            getFIs(),
            getFields()
        ]);
        setFis(fiList);
        setMasterFields(schemaFields);
    }

    // ... (handleCreateFI unchanged)

    async function handleAnalyzeQuestionnaire(id: string) {
        setLoading(true);
        try {
            const res = await analyzeQuestionnaire(id);
            setQContext({ name: res.questionnaireName });
            setSelectedFi(res.fiOrgId); // Set context

            // Process suggestions
            const processed = res.suggestions.map(s => {
                if (s.newFieldProposal && !s.suggestedKey) {
                    return { ...s, suggestedKey: "CREATE_NEW:" + s.newFieldProposal.key };
                }
                return s;
            });

            setSuggestions(processed);
            setStep(2);
        } catch (e) {
            alert("Failed to load questionnaire analysis");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleAnalyze() {
        // ... (Unchanged logic for File Upload mode)
        if (!file || !selectedFi) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const text = await parseDocument(formData);
            const results = await generateMappingSuggestions(text);
            const processed = results.map(s => {
                if (s.newFieldProposal && !s.suggestedKey) {
                    return { ...s, suggestedKey: "CREATE_NEW:" + s.newFieldProposal.key };
                }
                return s;
            });
            setSuggestions(processed);
            setStep(2);
        } catch (e) {
            alert("Analysis failed");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setLoading(true);
        try {
            // 1. Identify New Fields (Shared logic)
            const fieldsToCreate: any[] = [];
            suggestions.forEach(s => {
                if (s.suggestedKey?.startsWith("CREATE_NEW:") && s.newFieldProposal) {
                    fieldsToCreate.push({
                        key: s.newFieldProposal.key,
                        label: s.newFieldProposal.label,
                        type: s.newFieldProposal.type,
                        description: s.newFieldProposal.description
                    });
                }
            });

            // 2. Append to Master Schema
            if (fieldsToCreate.length > 0) {
                const appendRes = await appendFieldsToActiveSchema(fieldsToCreate);
                if (!appendRes.success) throw new Error("Failed to append new fields");
            }

            // 3. Prepare Mapping JSON
            const mapping = suggestions
                .filter(s => s.suggestedKey && s.suggestedKey !== "IGNORE_SKIP")
                .map(s => {
                    let finalKey = s.suggestedKey!;
                    if (finalKey.startsWith("CREATE_NEW:")) {
                        finalKey = finalKey.replace("CREATE_NEW:", "");
                    }
                    return {
                        fiQuestion: s.originalText,
                        masterKey: finalKey
                    };
                });

            // 4. SAVE (Branch Logic)
            if (questionnaireId) {
                await saveQuestionnaireChanges(questionnaireId, [], mapping);
                alert("Questionnaire Mappings Saved!");
                router.push(`/app/admin/organizations/${selectedFi}`); // Return to org page
            } else {
                await saveFIMapping(selectedFi, mapping);
                alert(`Saved! ${mapping.length} mappings confirmed.`);
                setStep(1);
                setSuggestions([]);
                setFile(null);
                loadData();
            }

        } catch (e) {
            alert("Failed to save");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function updateSuggestion(index: number, newKey: string) {
        const newSuggestions = [...suggestions];
        newSuggestions[index].suggestedKey = newKey;
        setSuggestions(newSuggestions);
    }

    async function handleCreateFI() {
        if (!newFiName) return;
        const res = await createFI(newFiName);
        if (res.success) {
            setFis([...fis, res.data]);
            setSelectedFi(res.data?.id || "");
            setNewFiName("");
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">
                    {questionnaireId ? `Mapping: ${qContext?.name || "Loading..."}` : "AI Schema Mapper"}
                </h1>
                {questionnaireId && (
                    <Link href={`/app/admin/organizations/${selectedFi}`}>
                        <Button variant="ghost">Exit</Button>
                    </Link>
                )}
            </div>

            {loading && step === 1 && questionnaireId && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Analyzing questionnaire document...</p>
                </div>
            )}

            {/* STEP 1: UPLOAD (Only if NOT in questionnaire context) */}
            {step === 1 && !questionnaireId && (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Select Financial Institution</CardTitle>
                            <CardDescription>Who is this questionnaire for?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
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
                            <div className="flex gap-2 items-center">
                                <span className="text-sm text-muted-foreground">- OR -</span>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="New FI Name (e.g. Goldman Sachs)"
                                    value={newFiName}
                                    onChange={e => setNewFiName(e.target.value)}
                                />
                                <Button onClick={handleCreateFI} variant="outline">Create</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>2. Upload Document</CardTitle>
                            <CardDescription>PDF, Word (.docx), Image, or Text file</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                type="file"
                                accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.docx"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                            />
                            <Button
                                onClick={handleAnalyze}
                                disabled={!file || !selectedFi || loading}
                                className="w-full"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Analyze Document"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* STEP 2: REVIEW */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Review & Confirm Mapping</CardTitle>
                        <CardDescription>
                            Review the AI's suggestions. You can map to existing fields or <strong>create new ones</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%]">FI Question (Extracted)</TableHead>
                                    <TableHead className="w-[40%]">Compass Field (Master Schema)</TableHead>
                                    <TableHead className="w-[20%]">Confidence</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suggestions.map((suggestion, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="break-words whitespace-pre-wrap max-w-sm">
                                            {suggestion.originalText}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={suggestion.suggestedKey}
                                                onValueChange={(val) => updateSuggestion(idx, val)}
                                            >
                                                <SelectTrigger className={
                                                    suggestion.suggestedKey?.startsWith("CREATE_NEW:")
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                        : !suggestion.suggestedKey ? "border-red-500" : ""
                                                }>
                                                    <SelectValue placeholder="Select a field..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="IGNORE_SKIP">-- Ignore / No Match --</SelectItem>

                                                    {/* NEW PROPOSAL OPTION */}
                                                    {suggestion.newFieldProposal && (
                                                        <SelectItem
                                                            value={`CREATE_NEW:${suggestion.newFieldProposal.key}`}
                                                            className="font-semibold text-blue-600 focus:text-blue-700"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Plus className="h-4 w-4" />
                                                                <span>Create New: {suggestion.newFieldProposal.label}</span>
                                                                <Badge variant="secondary" className="text-xs ml-2">{suggestion.newFieldProposal.type}</Badge>
                                                            </div>
                                                        </SelectItem>
                                                    )}

                                                    {masterFields.map(f => (
                                                        <SelectItem key={f.key} value={f.key}>
                                                            {f.label} ({f.key})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-xs ${suggestion.confidence > 0.8 ? "bg-green-100 text-green-800" :
                                                    suggestion.confidence > 0.5 ? "bg-yellow-100 text-yellow-800" :
                                                        "bg-red-100 text-red-800"
                                                    }`}>
                                                    {(suggestion.confidence * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="flex justify-end gap-2 mt-6">
                            {!questionnaireId && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
                            <Button onClick={handleSave} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Mapping"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
