import { getEffectiveRequirements } from "@/actions/client-le";
import { getClientLEData } from "@/actions/client";
import { SmartForm } from "@/components/client/smart-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function LEPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // 1. Fetch LE with Security Check
    const data = await getClientLEData(id);
    if (!data || !data.le || !data.schema) return notFound();

    const { le, schema } = data;

    // 2. Fetch Requirements (Smart View)
    const { success, fields, progress } = await getEffectiveRequirements(id);

    if (!success || !schema) {
        return (
            <div className="max-w-5xl mx-auto pt-10">
                <Card>
                    <CardHeader>
                        <CardTitle>System Unavailable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>The Master Schema is not active. Please contact support.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{le.name}</h1>
                    <p className="text-muted-foreground">{le.jurisdiction} • {le.status}</p>
                </div>
                <Link href="/app" className="text-sm text-blue-600 hover:underline">
                    &larr; Back to Dashboard
                </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card className="md:col-span-3 border-transparent shadow-none bg-transparent">
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-200 mb-6">
                        <div className="flex justify-between items-center">
                            <strong>Master Schema v{schema.version}</strong>
                            {progress && (
                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {Math.round((progress.filled / progress.total) * 100)}% Complete
                                </span>
                            )}
                        </div>
                        <p className="mt-1 opacity-90">
                            You are viewing the consolidated list of questions required by your financial partners.
                            Answers are automatically shared with the relevant institutions.
                        </p>
                    </div>

                    <SmartForm
                        clientLEId={le.id}
                        requirements={fields || []}
                    />
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Your Engagements</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Active engagements determine which questions appear in your Smart Form.
                            </p>
                            <Link href={`/app/le/${le.id}/requirements`}>
                                <div className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors">
                                    Manage Requirements
                                </div>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

