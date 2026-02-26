import prisma from "@/lib/prisma";
import { FieldGlossaryTable } from "@/components/client/admin/field-glossary-table";

export default async function FieldGlossaryPage() {
    let fields: any[] = [];
    try {
        fields = await (prisma as any).masterFieldDefinition.findMany({
            orderBy: [
                { category: 'asc' },
                { order: 'asc' }
            ]
        });
    } catch (e) {
        console.error("Failed to fetch fields", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">Field Glossary</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Authoritative list of all atomic data points collected across the platform.</p>
                </div>
            </div>

            <FieldGlossaryTable initialFields={fields} />
        </div>
    );
}
