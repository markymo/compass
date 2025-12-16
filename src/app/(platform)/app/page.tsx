
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureUserOrg, getClientLEs } from "@/actions/client";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

export default async function ClientDashboardPage() {
    const { userId, sessionClaims } = await auth();
    let orgName = "Client";

    if (userId) {
        const email = (sessionClaims?.email as string) || "";
        const org = await ensureUserOrg(userId, email);
        if (org) orgName = org.name;
    }

    const les = await getClientLEs();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-6">
                <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 p-4 flex items-center gap-3 shadow-sm rounded-r-md">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    <div className="text-sm text-blue-900 dark:text-blue-200">
                        <span className="font-semibold block sm:inline">Client Area:</span>{" "}
                        <span className="opacity-90">Manage your legal entities and document mapping.</span>
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Your Client Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {orgName}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Legal Entities
                        </CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{les.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Active legal entities managed
                        </p>
                        <Link href="/app/le" className="mt-4 flex items-center text-sm text-blue-600 hover:underline">
                            View Entities <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
