
import { getClientLEs } from "@/actions/client";
import { CreateLEDialog } from "@/components/client/create-le-dialog";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ClientEntitiesPage() {
    const { userId } = await auth();
    const les = await getClientLEs();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Legal Entities</h1>
                    <p className="text-muted-foreground">Manage your Legal Entities and Data.</p>
                </div>
                <CreateLEDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {les.map((le) => (
                    <div key={le.id} className="relative group">
                        <Link href={`/app/le/${le.id}`}>
                            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{le.name}</CardTitle>
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                            v1
                                        </Badge>
                                    </div>
                                    <CardDescription>{le.jurisdiction}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-xs font-mono px-2 py-1 rounded inline-block ${le.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                        {le.status}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* V2 Quick Link */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/app/le/${le.id}/v2`}>
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm">
                                    Try V2 <ArrowRight className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}
                {les.length === 0 && (
                    <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                            <Briefcase className="h-8 w-8 opacity-50" />
                            <p>No entities found. Create one to get started.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
