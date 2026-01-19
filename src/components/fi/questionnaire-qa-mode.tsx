"use client";


import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, AlertCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
    id: string;
    text: string;
    answer: string | null;
    status: string;
    order: number;
}

interface QuestionnaireQAModeProps {
    questions: Question[];
    // TODO: Add save/update handlers
}

export function QuestionnaireQAMode({ questions }: QuestionnaireQAModeProps) {
    const [activeQuestionId, setActiveQuestionId] = React.useState<string | null>(
        questions.length > 0 ? questions[0].id : null
    );

    const activeQuestion = questions.find(q => q.id === activeQuestionId);

    return (
        <div className="flex h-full bg-slate-50">
            {/* Left Sidebar: Question List */}
            <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Questions</h3>
                    <p className="text-xs text-slate-500">{questions.length} items to review</p>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-slate-100">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => setActiveQuestionId(q.id)}
                                id={`question-${q.id}`}
                                className={cn(
                                    "w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3",
                                    activeQuestionId === q.id ? "bg-indigo-50/50 border-l-4 border-l-indigo-500" : "border-l-4 border-l-transparent"
                                )}
                            >
                                <div className="mt-1">
                                    {q.status === 'DONE' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-slate-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-medium line-clamp-2", activeQuestionId === q.id ? "text-indigo-900" : "text-slate-700")}>
                                        <span className="text-slate-400 mr-2">#{idx + 1}</span>
                                        {q.text}
                                    </p>
                                    {q.answer && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
                                            "{q.answer}"
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Panel: Active Question Detail */}
            <div className="flex-1 flex flex-col">
                {activeQuestion ? (
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-2xl mx-auto space-y-6">
                            {/* Question Header */}
                            <div className="space-y-4">
                                <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                    Question {questions.findIndex(q => q.id === activeQuestion.id) + 1} of {questions.length}
                                </Badge>
                                <h1 className="text-xl font-semibold text-slate-900 leading-relaxed">
                                    {activeQuestion.text}
                                </h1>
                            </div>

                            {/* Answer Area */}
                            <Card className="border-indigo-100 shadow-sm">
                                <CardContent className="p-0">
                                    <div className="p-3 bg-indigo-50/30 border-b border-indigo-100 flex justify-between items-center">
                                        <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">Refined Answer</span>
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none shadow-none">Auto-Filled</Badge>
                                    </div>
                                    <div className="p-4">
                                        <textarea
                                            className="w-full min-h-[150px] p-0 border-none resize-none focus:ring-0 text-slate-700 leading-relaxed text-sm bg-transparent"
                                            placeholder="Type your answer here..."
                                            defaultValue={activeQuestion.answer || ""}
                                        />
                                    </div>
                                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                        <Button variant="ghost" size="sm">Flag for Review</Button>
                                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Save Answer</Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Context / Source (Placeholder) */}
                            <div className="space-y-2 pt-4 border-t border-slate-200">
                                <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-slate-400" />
                                    Reviewer Comments
                                </h4>
                                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500 italic text-center">
                                    No comments yet.
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                        Select a question to view details
                    </div>
                )}
            </div>
        </div>
    );
}
