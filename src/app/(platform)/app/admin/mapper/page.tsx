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

export default function MapperPage() {
    const [fis, setFis] = useState<any[]>([]);
    const [selectedFi, setSelectedFi] = useState("");
    const [newFiName, setNewFiName] = useState("");

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Select/Upload, 2: Review

    const [masterFields, setMasterFields] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);

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
        }
    }

    async function handleAnalyze() {
        if (!file || !selectedFi) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            // 1. Text Extraction
            const text = await parseDocument(formData);

            // 2. AI Analysis
            const results = await generateMappingSuggestions(text);

            // Post-process: specificy default selection
            const processed = results.map(s => {
                // If it has a new proposal and NO suggested existing key, select the new proposal
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
            // 1. Identify New Fields to Create
            const fieldsToCreate: any[] = [];

            suggestions.forEach(s => {
                if (s.suggestedKey.startsWith("CREATE_NEW:") && s.newFieldProposal) {
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
                if (!appendRes.success) {
                    throw new Error("Failed to append new fields");
                }
            }

            // 3. Save FI Mapping
            // We need to map the "CREATE_NEW:key" values back to just "key"
            const mapping = suggestions
                .filter(s => s.suggestedKey && s.suggestedKey !== "IGNORE_SKIP")
                .map(s => {
                    let finalKey = s.suggestedKey;
                    if (finalKey.startsWith("CREATE_NEW:")) {
                        finalKey = finalKey.replace("CREATE_NEW:", "");
                    }
                    return {
                        fiQuestion: s.originalText,
                        masterKey: finalKey
                    };
                });

            await saveFIMapping(selectedFi, mapping);

            alert(`Saved! ${mapping.length} mappings confirmed. ${fieldsToCreate.length} new fields created.`);

            // Reset
            setStep(1);
            setSuggestions([]);
            setFile(null);
            // Refresh schema fields for next time
            loadData();

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">AI Schema Mapper</h1>
            </div>

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
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
                            <CardDescription>PDF or Text file of the questionnaire</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                type="file"
                                accept=".pdf,.txt"
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
                                        <TableCell>{suggestion.originalText}</TableCell>
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
                            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
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
