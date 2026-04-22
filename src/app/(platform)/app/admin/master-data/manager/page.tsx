import prisma from "@/lib/prisma";
import MasterDataManager from "@/components/client/admin/master-data-manager";
import { getCategoriesWithFields } from "@/actions/master-data-sort";
import { getUserPreferences } from "@/actions/user-preferences";

export default async function MasterDataManagerPage() {
    // 1. Fetch the temporary note from system settings
    let temporaryNote = "";
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: "ADMIN_MANAGER_NOTE" }
        });
        if (setting && setting.value) {
            temporaryNote = String(setting.value);
        }
    } catch (e) {
        console.error("Failed to fetch ADMIN_MANAGER_NOTE", e);
    }

    // 2. Fetch all fields for the flat 'glossary' view AND the 'sort' capabilities
    // The sort-builder provides categories and uncategorized fields. We just need the raw categories with their full fields
    const data = await getCategoriesWithFields();

    // To prevent React serialization errors on Decimal fields or complex types, we could parse. But getCategoriesWithFields works in sort page.
    
    // We also need all raw fields to power the flat view or searching
    let rawFields: any[] = [];
    try {
        rawFields = await (prisma as any).masterFieldDefinition.findMany({
            include: {
                sourceMappings: true,
                graphBindings: true,
                masterDataCategory: true
            },

            orderBy: [
                { order: 'asc' },
                { fieldNo: 'asc' }
            ]
        });
    } catch (e) {
        console.error("Failed to fetch raw fields", e);
    }

    // 3. Fetch User Preferences for UI state (Column sizes, visibility, etc.)
    let initialUserConfig = null;
    try {
        const prefRes = await getUserPreferences();
        if (prefRes.success && prefRes.preferences?.masterDataManager) {
            initialUserConfig = prefRes.preferences.masterDataManager;
        }
    } catch (e) {
        console.error("Failed to fetch user preferences", e);
    }

    return (
        <div className="space-y-6 w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">Master Data Manager</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage field definitions, ordering, categorization and system flags.</p>
                </div>
            </div>

            <MasterDataManager 
                initialData={data} 
                rawFields={rawFields} 
                initialNote={temporaryNote}
                initialUserConfig={initialUserConfig}
            />
        </div>
    );
}
