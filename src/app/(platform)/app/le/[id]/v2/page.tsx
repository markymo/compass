import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Library, Database } from "lucide-react";
import { EditableDescription } from "@/components/client/editable-description";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
                        <EditableDescription leId={(le as any).id} initialValue={(le as any).description} />
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

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="min-h-[200px] p-6 border rounded-xl bg-white shadow-sm flex flex-col justify-between">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">Health Check</h3>
                                <p className="text-sm text-slate-500 italic">"Waiting for actual data metrics..."</p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="library" className="min-h-[400px] border-2 border-dashed rounded-xl bg-slate-50/50 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <p className="text-slate-500 font-medium">Questionnaire Library Module</p>
                        <p className="text-slate-400 text-sm">"Discovery and Preparation Workbench coming next..."</p>
                    </div>
                </TabsContent>

                <TabsContent value="standing-data" className="min-h-[400px] border-2 border-dashed rounded-xl bg-slate-50/50 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <p className="text-slate-500 font-medium">Standing Data Workbench</p>
                        <p className="text-slate-400 text-sm">"Core vs Derived Data View coming next..."</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
