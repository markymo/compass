import { getLatestSchema } from "@/actions/schema";
import { SchemaEditor } from "@/components/admin/schema-editor";

export default async function SchemaPage() {
    const latestSchema = await getLatestSchema();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Master Schema</h1>
                <p className="text-muted-foreground">Manage the Master Question Bank.</p>
            </div>

            <SchemaEditor initialSchema={latestSchema} />
        </div>
    );
}
