"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, ArrowRight, CheckCircle2, ListChecks, Layers, AlertCircle } from "lucide-react";
import { parseRawText } from "@/actions/questionnaire";

interface ExtractTextStepProps {
    questionnaireId: string;
    initialText: string;
    analysisResults?: any[]; // If present, shows summary
    onAnalyzeComplete: () => void;
    onOpenWorkbench: () => void;
}

export function ExtractTextStep({ questionnaireId, initialText, analysisResults, onAnalyzeComplete, onOpenWorkbench }: ExtractTextStepProps) {
    const [rawText, setRawText] = useState(initialText || "");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync rawText if initialText updates (e.g. re-extraction)
    useEffect(() => {
        if (initialText) setRawText(initialText);
    }, [initialText]);

    const handleAnalyze = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const result = await parseRawText(questionnaireId, rawText);
            if (!result.success) {
                throw new Error(result.error || "Parsing failed");
            }
            onAnalyzeComplete();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const hasResults = analysisResults && analysisResults.length > 0;
    const questions = hasResults ? analysisResults!.filter(i => i.type === "QUESTION") : [];
    const sections = hasResults ? analysisResults!.filter(i => i.type === "SECTION") : [];

    return (
        <Card className="w-full h-full flex flex-col border-0 shadow-none">
            {/* Header */}
            <div className="flex-none p-4 pb-0">
                {!hasResults && (
                    <CardDescription className="mb-2">
                        Review and edit the raw text extracted from your document. Correct any OCR errors, then click Analyze.
                    </CardDescription>
                )}
            </div>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-4 p-4">
                <Textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="flex-1 font-mono text-sm resize-none p-4 leading-relaxed"
                    placeholder="No text extracted. Please type or paste text here..."
                />

                {/* Analysis Summary Area (Bottom) */}
                {hasResults && (
                    <div className="flex-none bg-green-50 border border-green-100 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-green-700">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="font-semibold">Analysis Complete</span>
                                </div>
                                <div className="h-4 w-px bg-green-200" />
                                <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-1.5 text-blue-700">
                                        <ListChecks className="h-4 w-4" />
                                        <span className="font-medium">{questions.length} Questions</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-purple-700">
                                        <Layers className="h-4 w-4" />
                                        <span className="font-medium">{sections.length} Sections</span>
                                    </div>
                                </div>
                            </div>

                            <Button size="sm" onClick={onOpenWorkbench} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                                Go to Workbench
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex justify-between border-t p-4 bg-gray-50 flex-none">
                <div className="text-red-500 text-sm font-medium">{error}</div>
                <div className="flex gap-3">
                    {/* If results exist, "Re-Analyze" is secondary. If not, Analyze is primary. */}
                    <Button
                        onClick={handleAnalyze}
                        disabled={isProcessing || !rawText.trim()}
                        variant={hasResults ? "outline" : "default"}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                {hasResults ? "Re-Analyze Text" : "Confirm & Analyze Structure"}
                                {!hasResults && <ArrowRight className="ml-2 h-4 w-4" />}
                            </>
                        )}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
