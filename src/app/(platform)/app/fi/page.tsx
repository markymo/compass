
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFIOganization } from "@/actions/fi";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

export default async function FIDashboard() {
    const org = await getFIOganization();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Institution Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {org?.name}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Questionnaires
                        </CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Manage</div>
                        <p className="text-xs text-muted-foreground">
                            Upload and view mapping status
                        </p>
                        <Link href="/app/fi/questionnaires" className="mt-4 flex items-center text-sm text-blue-600 hover:underline">
                            Go to Library <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
