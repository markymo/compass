import prisma from "@/lib/prisma";
import { OptionSetsTable } from "@/components/client/admin/option-sets-table";

export default async function OptionSetsPage() {
    let optionSets: any[] = [];
    try {
        optionSets = await prisma.masterDataOptionSet.findMany({
            orderBy: { name: 'asc' }
        });
    } catch (e) {
        console.error("Failed to fetch option sets", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">Option Sets</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage reusable dropdown choices for Master Data fields.</p>
                </div>
            </div>

            <OptionSetsTable initialOptionSets={optionSets} />
        </div>
    );
}
