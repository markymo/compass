import prisma from "@/lib/prisma";
import { FieldGlossaryTable } from "@/components/client/admin/field-glossary-table";
import { AIDescriptionGenerator } from "@/components/client/admin/ai-description-generator";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function FieldGlossaryPage() {
    let fields: any[] = [];
    try {
        fields = await (prisma as any).masterFieldDefinition.findMany({
            include: {
                sourceMappings: true
            },
            orderBy: [
                { categoryId: 'asc' },
                { order: 'asc' }
            ]
        });
    } catch (e) {
        console.error("Failed to fetch fields", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800 shadow-sm">
                    <div className="bg-amber-100 p-1.5 rounded-full">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">This page is deprecated</p>
                        <p className="text-xs opacity-90 mt-0.5">
                            Please use the new <Link href="/app/admin/master-data/manager" className="underline font-medium hover:text-amber-950">Master Data Manager</Link> for a better field management experience. 
                            This glossary view will be removed in a future update.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">Field Glossary</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Authoritative list of all atomic data points collected across the platform.</p>
                    </div>
                </div>
            </div>

            <AIDescriptionGenerator fields={fields} />

            <FieldGlossaryTable initialFields={fields} />
        </div>
    );
}
