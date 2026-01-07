"use client";

import { useState, useMemo } from "react";
import { generateAnswers, SuggestedAnswer } from "@/actions/ai-autofill";
import { learnFromAnswers } from "@/actions/ai-learning";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, Wand2, Lock, Unlock, ChevronRight, AlertCircle } from "lucide-react";
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

    // Vertical Navigation State
    const [activeCategory, setActiveCategory] = useState<string>("Uncategorized");

    // Computed Categories and Progress
    const categories = useMemo(() => {
        const cats = new Set<string>();
        questions.forEach((q: any) => {
            if (q.type === "QUESTION") {
                cats.add(q.category || "Uncategorized");
            }
        });
        return Array.from(cats).sort((a, b) => {
            if (a === "Uncategorized") return 1;
            if (b === "Uncategorized") return -1;
            return a.localeCompare(b);
        });
    }, [questions]);

    // Ensure active category is valid (e.g. on first load)
    if (!categories.includes(activeCategory) && categories.length > 0) {
        setActiveCategory(categories[0]);
    }

    // Filter questions for active category
    const activeQuestions = useMemo(() => {
        return questions.filter((q: any) =>
            q.type === "QUESTION" && (q.category || "Uncategorized") === activeCategory
        );
    }, [questions, activeCategory]);

    const handleAutoFill = async () => {
        setIsGenerating(true);
        const lockedIndices = questions
            .map((q: any, i: number) => (q.isLocked ? i : -1))
            .filter((i: number) => i !== -1);

        const res = await generateAnswers(leId, questionnaireId, lockedIndices);

        if (res.success && res.data) {
            if (res.debugMessages) {
                console.groupCollapsed("🤖 Auto-Fill AI Context & Prompt");
                console.log(res.debugMessages);
                console.groupEnd();
            }

            const newGhostAnswers: Record<string, SuggestedAnswer> = {};
            res.data.forEach(ans => {
                newGhostAnswers[ans.questionId] = ans;
            });
            setGhostAnswers(newGhostAnswers);
        } else {
            alert("Auto-Fill Failed: " + res.error);
        }
        setIsGenerating(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await saveQuestionnaireChanges(questionnaireId, questions);

            if (res.success) {
                let msg = "Progress saved!";
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
                return { ...q, answer: ghost.suggestedAnswer };
            }
            return q;
        }));

        const newGhosts = { ...ghostAnswers };
        delete newGhosts[index.toString()];
        setGhostAnswers(newGhosts);
    };

    const handleReject = (index: number) => {
        const newGhosts = { ...ghostAnswers };
        delete newGhosts[index.toString()];
        setGhostAnswers(newGhosts);
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return "text-emerald-600 bg-emerald-50 border-emerald-200";
        if (score >= 0.5) return "text-amber-600 bg-amber-50 border-amber-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    // Helper to calculate progress per category
    const getCategoryProgress = (cat: string) => {
        const catQuestions = questions.filter((q: any) =>
            q.type === "QUESTION" && (q.category || "Uncategorized") === cat
        );
        const answered = catQuestions.filter((q: any) => q.answer && q.answer.trim().length > 0).length;
        return { answered, total: catQuestions.length };
    };

    return (
        <div className="flex h-full flex-col">
            {/* Header: AI Actions */}
            <div className="flex-none p-4 border-b bg-white flex items-center justify-between z-10">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-purple-600" />
                        AI Auto-Fill
                    </h2>
                    <p className="text-xs text-slate-500">Auto-answer using Standing Data.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4 border-r pr-4">
                        <Switch
                            id="learning-mode"
                            checked={isLearning}
                            onCheckedChange={setIsLearning}
                        />
                        <div className="flex flex-col">
                            <label htmlFor="learning-mode" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                Auto-Learn
                            </label>
                        </div>
                    </div>

                    <Button
                        onClick={handleAutoFill}
                        disabled={isGenerating}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm"
                    >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {isGenerating ? "Analyzing..." : "Run Auto-Fill"}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} size="sm" className="bg-slate-900 text-white gap-2">
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* Main Content Area: Sidebar + Scrollable Questions */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Categories */}
                <div className="w-64 flex-none border-r bg-slate-50 overflow-y-auto py-4">
                    <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Sections
                    </div>
                    <div className="space-y-1 px-2">
                        {categories.map(cat => {
                            const progress = getCategoryProgress(cat);
                            const isComplete = progress.answered === progress.total && progress.total > 0;
                            const isActive = activeCategory === cat;

                            return (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between group ${isActive
                                            ? "bg-white shadow-sm text-slate-900 font-medium border border-slate-200"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                        }`}
                                >
                                    <span className="truncate max-w-[140px]">{cat}</span>
                                    {isComplete ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-100' : 'bg-slate-200/50 group-hover:bg-slate-200'}`}>
                                            {progress.answered}/{progress.total}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Area: Questions Scroll */}
                <div className="flex-1 overflow-y-auto p-8 scroll-smooth bg-white">
                    <div className="max-w-3xl mx-auto space-y-8 pb-20">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h2 className="text-2xl font-bold text-slate-900">{activeCategory}</h2>
                            <Badge variant="secondary">{activeQuestions.length} Questions</Badge>
                        </div>

                        {activeQuestions.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 italic">
                                No questions found in this category.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {activeQuestions.map((item: any) => {
                                    // Identify the REAL index in the master array to allow updates
                                    const realIndex = questions.findIndex(q => q === item);
                                    if (realIndex === -1) return null;

                                    const ghost = ghostAnswers[realIndex.toString()];
                                    const hasAnswer = !!item.answer;
                                    const isLocked = !!item.isLocked;

                                    return (
                                        <div key={realIndex} id={`q-${realIndex}`} className="scroll-mt-24 group">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-none pt-1">
                                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border ${hasAnswer ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                                                        {activeQuestions.indexOf(item) + 1}
                                                    </div>
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-start justify-between">
                                                        <label className="text-sm font-medium text-slate-900 leading-relaxed block max-w-xl">
                                                            {item.originalText}
                                                        </label>
                                                        <button
                                                            onClick={() => {
                                                                setQuestions(prev => prev.map((q, i) => i === realIndex ? { ...q, isLocked: !q.isLocked } : q));
                                                            }}
                                                            className={`p-1 rounded-full transition-colors ${isLocked ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-slate-500"}`}
                                                        >
                                                            {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>

                                                    <div className="relative">
                                                        {hasAnswer ? (
                                                            <div className="relative">
                                                                <Textarea
                                                                    className={`min-h-[80px] text-sm resize-y ${isLocked ? "bg-slate-50 text-slate-500" : "bg-white"}`}
                                                                    value={item.answer}
                                                                    onChange={(e) => {
                                                                        if (isLocked) return;
                                                                        const val = e.target.value;
                                                                        setQuestions(prev => prev.map((q, i) => i === realIndex ? { ...q, answer: val } : q));
                                                                    }}
                                                                    readOnly={isLocked}
                                                                />
                                                            </div>
                                                        ) : ghost ? (
                                                            // Ghost Answer Card
                                                            <div className={`p-4 rounded-lg border border-dashed ${getConfidenceColor(ghost.confidence)} transition-all animate-in fade-in duration-300`}>
                                                                <p className="text-sm font-medium italic mb-3">{ghost.suggestedAnswer}</p>

                                                                <div className="flex items-center justify-between text-xs opacity-80">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="bg-white/50">{Math.round(ghost.confidence * 100)}% Match</Badge>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button size="sm" variant="ghost" className="h-7 text-xs hover:bg-red-100 hover:text-red-700" onClick={() => handleReject(realIndex)}>Reject</Button>
                                                                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAccept(realIndex)}>Accept</Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Textarea
                                                                className="min-h-[80px] bg-slate-50/50 border-slate-200 placeholder:text-slate-400 text-sm resize-y focus:bg-white focus:border-indigo-300 transition-all"
                                                                placeholder="Type your answer..."
                                                                value=""
                                                                onChange={(e) => {
                                                                    if (isLocked) return;
                                                                    const val = e.target.value;
                                                                    setQuestions(prev => prev.map((q, i) => i === realIndex ? { ...q, answer: val } : q));
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {activeQuestions.indexOf(item) < activeQuestions.length - 1 && (
                                                <div className="h-px bg-slate-100 my-8 ml-10" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Next Section Button */}
                        <div className="pt-8 flex justify-end">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => {
                                    const currentIndex = categories.indexOf(activeCategory);
                                    if (currentIndex < categories.length - 1) {
                                        setActiveCategory(categories[currentIndex + 1]);
                                        // Scroll to top of container
                                        document.querySelector('.scroll-smooth')?.scrollTo(0, 0);
                                    } else {
                                        alert("You've reached the end of the questionnaire!");
                                    }
                                }}
                            >
                                Next Section <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
