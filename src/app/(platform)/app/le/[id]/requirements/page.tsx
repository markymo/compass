import { getActiveEngagements, removeRequirement } from "@/actions/requirements";
import { QuestionnaireSearch } from "@/components/client/requirement-search"; // Updated import name
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, Trash2 } from "lucide-react";
import Link from "next/link";
import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { RemoveRequirementButton } from "@/components/client/remove-requirement-button";

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Security check
    const data = await getClientLEData(id);
    if (!data || !data.le) return notFound();

    const engagements = await getActiveEngagements(id);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Questionnaire Library</h1>
                    <p className="text-muted-foreground">{data.le.name}</p>
                </div>
                <Link href={`/app/le/${id}`} className="text-sm text-blue-600 hover:underline">
                    &larr; Back to Smart Form
                </Link>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Engaged Institutions</CardTitle>
                        <CardDescription>All questionnaires currently active for this entity.</CardDescription>
                    </div>
                    <QuestionnaireSearch clientLEId={id} />
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {engagements.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                <p>No requirements found. Add a Financial Institution to get started.</p>
                            </div>
                        ) : (
                            engagements.map(eng => (
                                <div key={eng.id} className="border rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <Building2 className="w-4 h-4 text-slate-500" />
                                            {eng.org.name}
                                        </div>
                                        <Badge variant="outline">{eng.questionnaires.length} Forms</Badge>
                                    </div>
                                    <div className="divide-y">
                                        {eng.questionnaires.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground italic">No specific forms selected.</div>
                                        ) : (
                                            eng.questionnaires.map(q => (
                                                <div key={q.id} className="flex items-center justify-between p-4 bg-white dark:bg-card hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="w-4 h-4 text-blue-500" />
                                                        <span className="font-medium">{q.name}</span>
                                                    </div>
                                                    <RemoveRequirementButton
                                                        engagementId={eng.id}
                                                        questionnaireId={q.id}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
