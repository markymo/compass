import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database, Table as TableIcon, RefreshCcw, Check } from "lucide-react";
import { EditableDescription } from "@/components/client/editable-description";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionnaireLibrary } from "@/components/client/questionnaire-library";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StandingDataWorkbench } from "@/components/client/standing-data-workbench";

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
                        <EditableDescription leId={le.id} initialValue={(le as any).description} />
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-0">
                <TabsList className="bg-transparent p-0 flex justify-start h-auto gap-0.5 border-b-0 space-x-1">
                    <TabsTrigger
                        value="overview"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="library"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Library className="h-4 w-4" />
                        Selected Questionnaires
                    </TabsTrigger>
                    <TabsTrigger
                        value="standing-data"
                        className="gap-2 px-6 py-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] data-[state=active]:z-10 transition-all shadow-none"
                    >
                        <Database className="h-4 w-4" />
                        Standing Data
                    </TabsTrigger>
                </TabsList>

                <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 relative min-h-[600px]">
                    <TabsContent value="overview" className="mt-0">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <div className="min-h-[200px] p-6 border rounded-xl bg-white shadow-sm flex flex-col justify-between">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-slate-900">Health Check</h3>
                                    <p className="text-sm text-slate-500 italic">"Waiting for actual data metrics..."</p>
                                </div>
                            </div>

                            <Card className="border-slate-200 shadow-none">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                                        <Library className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Selected Questionnaires</span>
                                    </div>
                                    <CardTitle className="text-xl">Preparation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Manage and prepare your FI questionnaires.
                                    </p>
                                    <Button variant="outline" className="w-full" asChild>
                                        <Link href="?tab=library">
                                            Go to Selected Questionnaires
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-none">
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

                    <TabsContent value="library" className="mt-0">
                        <QuestionnaireLibrary leId={id} />
                    </TabsContent>



                    <TabsContent value="standing-data" className="mt-0">
                        <div className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl p-8 min-h-[600px]">
                            <StandingDataWorkbench leId={id} />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
