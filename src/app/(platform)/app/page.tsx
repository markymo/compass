import { getClientLEs } from "@/actions/client";
import { CreateLEDialog } from "@/components/client/create-le-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function DashboardPage() {
    const les = await getClientLEs();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Manage your Legal Entities and Data.</p>
                </div>
                <CreateLEDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {les.map((le) => (
                    <Link key={le.id} href={`/app/le/${le.id}`}>
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                            <CardHeader>
                                <CardTitle>{le.name}</CardTitle>
                                <CardDescription>{le.jurisdiction}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-xs font-mono px-2 py-1 rounded inline-block ${le.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                    {le.status}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
                {les.length === 0 && (
                    <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        No entities found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
