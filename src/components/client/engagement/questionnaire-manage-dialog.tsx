"use client"

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { getQuestionnaireById, saveQuestionnaireChanges, analyzeQuestionnaire } from "@/actions/questionnaire";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";

interface QuestionnaireManageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questionnaireId: string;
    onUpdate?: () => void;
}

export function QuestionnaireManageDialog({ open, onOpenChange, questionnaireId, onUpdate }: QuestionnaireManageDialogProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState("questions");

    // Data State
    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);

    // Filter State
    const [filter, setFilter] = useState("");

    useEffect(() => {
        if (open && questionnaireId) {
            loadData();
        }
    }, [open, questionnaireId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getQuestionnaireById(questionnaireId);
            if (data) {
                setQuestionnaire(data);
                setQuestions(data.questions || []);
            } else {
                toast.error("Failed to load questionnaire");
                onOpenChange(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error loading data");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Convert questions back to the "extractedContent" format expected by saveQuestionnaireChanges
            // or just ensure saveQuestionnaireChanges handles the updates correctly.
            // The action expects an array of items. API signature: saveQuestionnaireChanges(id, items, mappings?)

            // We map the editable state back to items
            const itemsToSave = questions.map(q => ({
                type: "question",
                text: q.text,
                originalText: q.originalText || q.text,
                compactText: q.compactText,
                order: q.order,
                masterFieldNo: q.masterFieldNo,
                masterQuestionGroupId: q.masterQuestionGroupId
            }));

            const result = await saveQuestionnaireChanges(questionnaireId, itemsToSave);

            if (result.success) {
                toast.success("Changes saved successfully");
                if (onUpdate) onUpdate();
                onOpenChange(false);
            } else {
                toast.error(result.error || "Failed to save changes");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error saving changes");
        } finally {
            setSaving(false);
        }
    };

    const handleAutoMap = async () => {
        if (!confirm("This will use AI to re-analyze mappings. Existing manual mappings might be overwritten. Continue?")) return;

        setAnalyzing(true);
        try {
            // analyzeQuestionnaire returns suggestions
            const result = await analyzeQuestionnaire(questionnaireId);

            if (result && result.suggestions) {
                // Apply suggestions to current state
                const newQuestions = [...questions];
                let matchCount = 0;

                result.suggestions.forEach((sug: any) => {
                    // Match by text (approximate) or order?
                    // analyzeQuestionnaire re-processes the file. The order should match if the file hasn't changed.
                    // But here we are matching against existing DB questions.
                    // Best effort: Match by exact text or similar text.

                    const match = newQuestions.find(q => q.text === sug.text || q.originalText === sug.text);
                    if (match) {
                        if (sug.suggestedKey) {
                            // Check if it's a Group or Field
                            // Our prompt returns "masterKey" (Field) or "masterQuestionGroupId" (Group)
                            // The suggestion object from ai-mapper usually has 'suggestedKey' normalized.

                            // Let's check if the key exists in Groups or Fields
                            const isGroup = FIELD_GROUPS[sug.suggestedKey];
                            const isField = FIELD_DEFINITIONS[parseInt(sug.suggestedKey)];

                            if (isGroup) {
                                match.masterQuestionGroupId = sug.suggestedKey;
                                match.masterFieldNo = null;
                                matchCount++;
                            } else if (isField) {
                                match.masterFieldNo = parseInt(sug.suggestedKey);
                                match.masterQuestionGroupId = null;
                                matchCount++;
                            }
                        }
                    }
                });

                setQuestions(newQuestions);
                toast.success(`Auto-mapped ${matchCount} questions`);
            }
        } catch (error) {
            console.error(error);
            toast.error("Auto-mapping failed");
        } finally {
            setAnalyzing(false);
        }
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };

        // Mutually exclusive mapping logic
        if (field === 'masterFieldNo' && value) {
            newQuestions[index].masterQuestionGroupId = null;
        }
        if (field === 'masterQuestionGroupId' && value) {
            newQuestions[index].masterFieldNo = null;
        }

        setQuestions(newQuestions);
    };

    // Filtered list
    const filteredQuestions = questions.filter(q =>
        (q.text || "").toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle>Manage Questionnaire</DialogTitle>
                            <DialogDescription>
                                Edit question text and map to Master Data schema.
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleAutoMap} disabled={analyzing || loading}>
                                {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                Auto-Map
                            </Button>
                            <Button onClick={handleSave} disabled={saving || loading}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <Input
                            placeholder="Search questions..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="max-w-md"
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden bg-slate-50">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-4">
                                {filteredQuestions.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        No questions found.
                                    </div>
                                ) : (
                                    filteredQuestions.map((q, idx) => {
                                        // Find index in original array for updates
                                        const realIndex = questions.indexOf(q);

                                        return (
                                            <div key={q.id || idx} className="bg-white border rounded-lg p-4 shadow-sm flex gap-4 items-start">
                                                <div className="mt-2 text-xs font-mono text-slate-400 w-6">
                                                    #{q.order}
                                                </div>

                                                <div className="flex-1 space-y-3">
                                                    {/* Row 1: Text */}
                                                    <div>
                                                        <Label className="text-xs text-slate-400 mb-1 block">Question Text</Label>
                                                        <Input
                                                            value={q.text}
                                                            onChange={(e) => updateQuestion(realIndex, 'text', e.target.value)}
                                                            className="font-medium"
                                                        />
                                                    </div>

                                                    {/* Row 2: Mappings */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <Label className="text-xs text-slate-400 mb-1 block">Map to Field Group (Composite)</Label>
                                                            <Select
                                                                value={q.masterQuestionGroupId || "none"}
                                                                onValueChange={(val) => updateQuestion(realIndex, 'masterQuestionGroupId', val === "none" ? null : val)}
                                                            >
                                                                <SelectTrigger className={q.masterQuestionGroupId ? "border-indigo-200 bg-indigo-50 text-indigo-700" : ""}>
                                                                    <SelectValue placeholder="Select Group..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">-- None --</SelectItem>
                                                                    {Object.values(FIELD_GROUPS).map((g) => (
                                                                        <SelectItem key={g.id} value={g.id}>
                                                                            {g.label} ({g.id})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs text-slate-400 mb-1 block">Map to Single Field (Atomic)</Label>
                                                            <Select
                                                                value={q.masterFieldNo?.toString() || "none"}
                                                                onValueChange={(val) => updateQuestion(realIndex, 'masterFieldNo', val === "none" ? null : parseInt(val))}
                                                            >
                                                                <SelectTrigger className={q.masterFieldNo ? "border-blue-200 bg-blue-50 text-blue-700" : ""}>
                                                                    <SelectValue placeholder="Select Field..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="max-h-[300px]">
                                                                    <SelectItem value="none">-- None --</SelectItem>
                                                                    {Object.values(FIELD_DEFINITIONS).map((f) => (
                                                                        <SelectItem key={f.fieldNo} value={f.fieldNo.toString()}>
                                                                            {f.fieldNo}. {f.fieldName}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-8 flex justify-center mt-2">
                                                    {(q.masterFieldNo || q.masterQuestionGroupId) ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-slate-200" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="hidden">
                    {/* Hidden, actions in header */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

