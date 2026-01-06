import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database, Table as TableIcon, RefreshCcw, Check } from "lucide-react";
import { EditableDescription } from "@/components/client/editable-description";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionnaireLibrary } from "@/components/client/questionnaire-library";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function LEDashboardV2Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) {
        return notFound();
    }

    const { le } = data;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="space-y-4">
                <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link href="/app/le" className="hover:text-slate-900 transition-colors">
                        Client Dashboard
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-slate-900 font-medium">{le.name}</span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold ml-2">V2 PROTOTYPE</span>
                </nav>

                <div className="flex flex-col gap-6">
                    <h1 className="text-5xl font-bold tracking-tight font-serif text-slate-900">
                        {le.name}
                    </h1>

                    <div className="max-w-3xl">
                        <EditableDescription leId={le.id} initialValue={le.description} />
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="bg-slate-100/50 p-1 border">
                    <TabsTrigger value="overview" className="gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="library" className="gap-2">
                        <Library className="h-4 w-4" />
                        Questionnaire Library
                    </TabsTrigger>
                    <TabsTrigger value="standing-data" className="gap-2">
                        <Database className="h-4 w-4" />
                        Standing Data
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="min-h-[200px] p-6 border rounded-xl bg-white shadow-sm flex flex-col justify-between">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">Health Check</h3>
                                <p className="text-sm text-slate-500 italic">"Waiting for actual data metrics..."</p>
                            </div>
                        </div>

                        <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <Library className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Library</span>
                                </div>
                                <CardTitle className="text-xl">Preparation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-500 mb-4">
                                    Manage and prepare your FI questionnaires.
                                </p>
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href="?tab=library">
                                        Go to Library
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <Database className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Standing Data</span>
                                </div>
                                <CardTitle className="text-xl">Completeness</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end gap-2 mb-1">
                                    <span className="text-3xl font-bold text-slate-900">42%</span>
                                    <span className="text-slate-400 text-sm mb-1 pb-0.5">estimated</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                                    <div className="bg-emerald-500 h-full w-[42%]" />
                                </div>
                                <Button variant="outline" className="w-full">View Workbench</Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="library" className="mt-6">
                    <QuestionnaireLibrary leId={id} />
                </TabsContent>

                <TabsContent value="standing-data" className="mt-6">
                    <Card className="border-slate-200 min-h-[400px]">
                        <CardHeader className="border-b bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Standing Data Workbench</CardTitle>
                                    <CardDescription>Review and promote data to your Master Record</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <RefreshCcw className="h-4 w-4 text-slate-400" />
                                        Re-sync
                                    </Button>
                                    <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                        <Check className="h-4 w-4" />
                                        Finalize Record
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                <div className="p-4 bg-slate-100 rounded-full">
                                    <TableIcon className="h-8 w-8 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-slate-600 font-semibold">Generating Workbench View...</p>
                                    <p className="text-slate-400 text-sm mt-1">
                                        We are processing your library to identify core data fields.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-200 animate-pulse w-1/2" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
