import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
                <p className="text-muted-foreground">Manage the core configuration of Compass.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/app/admin/schema">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardHeader>
                            <CardTitle>Schema Engine</CardTitle>
                            <CardDescription>Manage the Master Question Bank</CardDescription>
                        </CardHeader>
                        <CardContent>
                            Define the global dataset and publish new versions.
                        </CardContent>
                    </Card>
                </Link>

                {/* Placeholder for future admin modules */}
                <Card className="opacity-50">
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>Coming Soon</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
