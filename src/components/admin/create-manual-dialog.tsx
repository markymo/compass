"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFIs } from "@/actions/questionnaire-library";
import { createManualQuestionnaire, generateAIQuestions } from "@/actions/questionnaire";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

export function CreateManualDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fis, setFis] = useState<any[]>([]);
    const [name, setName] = useState("");
    const [fiOrgId, setFiOrgId] = useState("");
    const [questions, setQuestions] = useState("");
    const [isGlobal, setIsGlobal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (open) {
            getFIs().then(res => setFis(res));
        }
    }, [open]);

    const onSubmit = async () => {
        if (!name || !questions) {
            toast.error("Please fill in Name and Questions.");
            return;
        }

        setLoading(true);
        // If the placeholder value is selected, send undefined to trigger server fallback
        const targetFiId = fiOrgId === "SYSTEM_INTERNAL_NONE" ? undefined : fiOrgId;
        const res = await createManualQuestionnaire({ name, fiOrgId: targetFiId || undefined, questions, isGlobal });
        setLoading(false);

        if (res.success) {
            toast.success("Questionnaire created successfully.");
            setOpen(false);
            setName("");
            setFiOrgId("");
            setQuestions("");
            setAiPrompt("");
            setIsGlobal(false);
            router.refresh();
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Manual
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Manual Questionnaire</DialogTitle>
                    <DialogDescription>
                        Manually define a standard questionnaire or generate one with AI.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
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
                            <SelectTrigger id="fi">
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
                            className="min-h-[200px]"
                            value={questions}
                            onChange={(e) => setQuestions(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create Questionnaire
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
