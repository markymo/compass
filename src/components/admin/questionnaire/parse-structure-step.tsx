"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, ListChecks, Layers, AlertCircle } from "lucide-react";

interface ParseStructureStepProps {
    questionnaireId: string;
    extractedContent: any[];
    onNext: () => void;
    onBack: () => void;
}

export function ParseStructureStep({ questionnaireId, extractedContent, onNext, onBack }: ParseStructureStepProps) {
    const questions = extractedContent.filter(i => i.type === "QUESTION");
    const sections = extractedContent.filter(i => i.type === "SECTION");
    const others = extractedContent.filter(i => i.type !== "QUESTION" && i.type !== "SECTION");

    return (
        <Card className="w-full max-w-2xl mx-auto mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    Analysis Complete
                </CardTitle>
                <CardDescription>
                    The AI has successfully analyzed the document structure. Here is what was found:
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center text-center">
                        <ListChecks className="h-8 w-8 text-blue-600 mb-2" />
                        <span className="text-2xl font-bold text-blue-800">{questions.length}</span>
                        <span className="text-sm text-blue-600 font-medium">Questions</span>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg flex flex-col items-center text-center">
                        <Layers className="h-8 w-8 text-purple-600 mb-2" />
                        <span className="text-2xl font-bold text-purple-800">{sections.length}</span>
                        <span className="text-sm text-purple-600 font-medium">Sections</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center text-center">
                        <AlertCircle className="h-8 w-8 text-gray-600 mb-2" />
                        <span className="text-2xl font-bold text-gray-800">{others.length}</span>
                        <span className="text-sm text-gray-600 font-medium">Notes/Instr.</span>
                    </div>
                </div>

                <div className="text-sm text-gray-500 mt-4">
                    Review the structure summary above. If it looks correct, proceed to the Mapping Workbench to assign categories and master schema keys. If the counts look wrong, you can go back and edit the raw text.
                </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-4 bg-gray-50">
                <Button variant="outline" onClick={onBack}>
                    Back to Text
                </Button>
                <Button onClick={onNext} className="bg-green-600 hover:bg-green-700">
                    Open Workbench
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    );
}
