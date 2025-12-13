import { ensureSchemaCategories, getLatestSchema } from "@/actions/schema";
import { SchemaManager } from "@/components/admin/schema-manager";
import { MasterSchemaDefinition } from "@/types/schema";

export default async function SchemaPage() {
    // We want the LATEST one to edit
    const latestSchema = await getLatestSchema();
    const definition = (latestSchema?.definition as any) as MasterSchemaDefinition | undefined;

    const fields = definition?.fields || [];
    const categories = definition?.categories || [];

    // Server Action Wrapper
    async function handleSeed() {
        "use server";
        await ensureSchemaCategories();
    }

    return (
        <div className="mx-auto space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-slate-100">
                    Master Compliance Schema
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">
                    Manage the Master Question Bank and map fields to compliance categories.
                </p>
            </div>

            <SchemaManager
                fields={fields}
                categories={categories}
                onSeed={handleSeed}
            />
        </div>
    );
}
