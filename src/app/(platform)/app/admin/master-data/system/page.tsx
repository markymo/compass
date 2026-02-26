import { MasterDataSystemTools } from "@/components/admin/MasterDataSystemTools";
import { Info, ShieldAlert } from "lucide-react";

export default function MasterDataSystemPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-slate-100">
                    Schema Maintenance
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
                    Internal tools for managing the master data infrastructure and synchronization.
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <MasterDataSystemTools />
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 dark:border-blue-900/30 dark:bg-blue-900/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Info className="h-5 w-5 text-blue-600" />
                            <h3 className="font-bold text-blue-900 dark:text-blue-400">System Information</h3>
                        </div>
                        <div className="space-y-4 text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                            <p>
                                The Master Data engine uses a <strong>Multi-Tier Dynamic Schema</strong> to bridge the <strong>Questionnaire Mapper</strong> and the <strong>Unified Entity Profiles</strong>.
                                By mapping specific questions inside source documents to centralized <strong>Master Fields</strong>, answers flow automatically into the entity’s 'Golden Record.'
                            </p>
                            <p>
                                This ensures that while data is often backed by evidence, the facts themselves are stored as independent, high-integrity records.
                                Administrative changes to field states or visibility are propagated to the <strong>KYC Workbench</strong> instantly via real-time cache invalidation.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-6 dark:border-amber-900/30 dark:bg-amber-900/10">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="h-5 w-5 text-amber-600" />
                            <h3 className="font-bold text-amber-900 dark:text-amber-400">Governance Policy</h3>
                        </div>
                        <ul className="space-y-2 text-xs text-amber-800 dark:text-amber-300 list-disc pl-4">
                            <li>Deactivating a field prevents it from being picked in new questionnaires.</li>
                            <li>Existing data for deactivated fields remains accessible in historical records.</li>
                            <li>Reordering fields affects the presentation in the KYC Workbench.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
