import { getClientLEData } from "@/actions/client";
import { DynamicForm } from "@/components/client/dynamic-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function LEPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data || !data.le) {
        return notFound();
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{data.le.name}</h1>
                    <p className="text-muted-foreground">{data.le.jurisdiction} • {data.le.status}</p>
                </div>
                <Link href="/app" className="text-sm text-blue-600 hover:underline">
                    &larr; Back to Dashboard
                </Link>
            </div>

            {!data.schema ? (
                <Card>
                    <CardHeader>
                        <CardTitle>No Active Schema</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>The system admin has not published a Master Schema yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-md border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-200">
                        <strong>Master Schema v{data.schema.version}</strong>
                        <p>Please complete the required information below. Changes are saved to version history.</p>
                    </div>

                    <DynamicForm
                        leId={data.le.id}
                        schemaId={data.schema.id}
                        definition={data.schema.definition as any}
                        initialData={data.record?.data}
                    />
                </div>
            )}
        </div>
    );
}
