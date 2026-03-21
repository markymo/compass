import { getCategoriesWithFields } from "@/actions/master-data-sort";
import MasterDataSortBuilder from "./sort-builder";

export default async function MasterDataSortPage() {
    const data = await getCategoriesWithFields();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-slate-100">
                    Sort Configuration
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
                    Drag and drop categories and fields to arrange the layout of the global master record.
                </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
                <MasterDataSortBuilder initialData={data} />
            </div>
        </div>
    );
}
