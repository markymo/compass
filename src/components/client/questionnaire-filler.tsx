"use client";

import { useState } from "react";
import { generateAnswers, SuggestedAnswer } from "@/actions/ai-autofill";
import { learnFromAnswers } from "@/actions/ai-learning";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, Wand2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { saveQuestionnaireChanges } from "@/actions/questionnaire";

interface QuestionnaireFillerProps {
    leId: string;
    questionnaireId: string;
    initialQuestions: any[]; // The extractedContent array
}

export function QuestionnaireFiller({ leId, questionnaireId, initialQuestions }: QuestionnaireFillerProps) {
    const [questions, setQuestions] = useState(initialQuestions);
    const [ghostAnswers, setGhostAnswers] = useState<Record<string, SuggestedAnswer>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLearning, setIsLearning] = useState(true);

    const handleAutoFill = async () => {
        setIsGenerating(true);
        // alert("Summoning the Ghostwriter..."); 

        const res = await generateAnswers(leId, questionnaireId);

        if (res.success && res.data) {
            // Map array to Record for easy lookup by ID
            const map: Record<string, SuggestedAnswer> = {};
            res.data.forEach(ans => {
                map[ans.questionId] = ans;
            });
            setGhostAnswers(map);
        } else {
            alert("Auto-Fill Failed: " + res.error);
        }
        setIsGenerating(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 1. Save Questionnaire Changes
            const res = await saveQuestionnaireChanges(questionnaireId, questions);

            if (res.success) {
                let msg = "Progress saved!";

                // 2. Trigger Learning (if enabled)
                if (isLearning) {
                    const qaPairs = questions
                        .filter((q: any) => q.answer && q.answer.trim().length > 0)
                        .map((q: any) => ({
                            question: q.originalText,
                            answer: q.answer,
                            category: q.category
                        }));

                    if (qaPairs.length > 0) {
                        const learnRes = await learnFromAnswers(leId, qaPairs);
                        if (learnRes.success && learnRes.count && learnRes.count > 0) {
                            msg += ` Knowledge Base updated with ${learnRes.count} new sections!`;
                        }
                    }
                }
                alert(msg);
            } else {
                alert("Failed to save: " + res.error);
            }
        } catch (e) {
            alert("Error saving: " + e);
        }
        setIsSaving(false);
    };

    const handleAccept = (index: number) => {
        const ghost = ghostAnswers[index.toString()];
        if (!ghost) return;

        setQuestions(prev => prev.map((q, i) => {
            if (i === index) {
                return { ...q, answer: ghost.suggestedAnswer }; // "Bake" the answer in
            }
            return q;
        }));

        // Remove from ghost state
        const newGhosts = { ...ghostAnswers };
        delete newGhosts[index.toString()];
        setGhostAnswers(newGhosts);
    };

    const handleReject = (index: number) => {
        const newGhosts = { ...ghostAnswers };
        delete newGhosts[index.toString()];
        setGhostAnswers(newGhosts);
    };

    // Helper to determine confidence color
    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return "text-emerald-600 bg-emerald-50 border-emerald-200";
        if (score >= 0.5) return "text-amber-600 bg-amber-50 border-amber-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-purple-600" />
                        AI Auto-Fill
                    </h2>
                    <p className="text-sm text-slate-500">Automatically answer questions using your Standing Data.</p>
                </div>
                <Button
                    onClick={handleAutoFill}
                    disabled={isGenerating}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-md hover:shadow-lg transition-all"
                >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isGenerating ? "Analyzing..." : "Auto-Fill Magic"}
                </Button>
            </div>

            <div className="space-y-4">
                {questions.map((item: any, index: number) => {
                    if (item.type !== "QUESTION") return null; // Skip sections for now

                    const ghost = ghostAnswers[index.toString()];
                    const hasAnswer = !!item.answer;

                    return (
                        <Card key={index} className="overflow-visible border-slate-200 shadow-sm relative transition-all hover:border-slate-300">
                            <CardContent className="pt-6 relative">
                                <div className="absolute top-4 right-4 text-xs font-mono text-slate-300">#{index + 1}</div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{item.originalText}</p>
                                        {item.category && (
                                            <Badge variant="outline" className="mt-1 text-[10px] text-slate-500 font-normal">
                                                {item.category}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Answer Area */}
                                    <div className="relative">
                                        {/* Real Answer (if accepted) */}
                                        {hasAnswer ? (
                                            <Textarea
                                                className="bg-white border-slate-300 text-slate-900 font-medium min-h-[80px]"
                                                value={item.answer}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, answer: val } : q));
                                                }}
                                            />
                                        ) : ghost ? (
                                            // Ghost Answer Overlay
                                            <div className="group relative">
                                                <div className={`p-3 rounded-md border-2 border-dashed ${getConfidenceColor(ghost.confidence)} transition-colors`}>
                                                    <p className="italic font-medium text-slate-800">{ghost.suggestedAnswer}</p>

                                                    {/* Audit Data Inline */}
                                                    <div className="mt-3 pt-3 border-t border-slate-200/50 text-xs text-slate-500 space-y-1">
                                                        <div className="flex items-start gap-2">
                                                            <Badge variant="secondary" className="bg-white/50 border shrink-0">
                                                                {Math.round(ghost.confidence * 100)}% Confidence
                                                            </Badge>
                                                            <div className="flex-1">
                                                                <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">Source:</span>
                                                                <span className="ml-1 italic">"{ghost.sourceQuote}"</span>
                                                            </div>
                                                        </div>
                                                        <div className="pl-0">
                                                            <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">Reasoning:</span>
                                                            <span className="ml-1">{ghost.reasoning}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex justify-end gap-2">
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(index)}>
                                                            Reject
                                                        </Button>
                                                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => handleAccept(index)}>
                                                            <Check className="h-3 w-3" />
                                                            Accept
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // Empty State
                                            <Textarea
                                                className="bg-slate-50 border-dashed border-slate-200 placeholder:text-slate-400 min-h-[80px]"
                                                placeholder="Type your answer here..."
                                                value=""
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, answer: val } : q));
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>


            {/* Save Button & Learning Toggle */}
            <div className="sticky bottom-4 flex items-center justify-end gap-6 bg-white/90 p-4 border-t backdrop-blur-sm -mx-4 rounded-b-xl">

                <div className="flex items-center gap-2">
                    <Switch
                        id="learning-mode"
                        checked={isLearning}
                        onCheckedChange={setIsLearning}
                    />
                    <div className="flex flex-col">
                        <label htmlFor="learning-mode" className="text-sm font-semibold text-slate-700 cursor-pointer">
                            Update Knowledge Base
                        </label>
                        <span className="text-[10px] text-slate-500">
                            Learn from my answers
                        </span>
                    </div>
                </div>

                <Button size="lg" className="shadow-xl bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
