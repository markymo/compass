import { getEffectiveRequirements, getLEEngagements } from "@/actions/client-le";
import { getClientLEData } from "@/actions/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEPortalContainer } from "@/components/client/le-portal-container";

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

    // 3. Fetch Engagements
    const { success: engSuccess, engagements } = await getLEEngagements(id);

    return (
        <LEPortalContainer
            le={le}
            schema={schema}
            requirements={fields || []}
            progress={progress}
            engagements={engagements || []}
        />
    );
}
