"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Network, Table as TableIcon } from "lucide-react";
import { KnowledgeGraphTable } from "./knowledge-graph-table";
import { EcosystemSpiderweb } from "./ecosystem-spiderweb";

interface KnowledgeGraphViewProps {
    leId: string;
    leName: string;
    initialNodes: any[];
    claims: any[];
}

export function KnowledgeGraphView({ leId, leName, initialNodes, claims }: KnowledgeGraphViewProps) {
    const [viewMode, setViewMode] = useState<"table" | "spiderweb">("table");

    return (
        <Card className="w-full shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50 border-b border-slate-100 rounded-t-xl pb-4">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Network className="h-5 w-5 text-indigo-500" />
                        Knowledge Graph
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Manage the holistic ecosystem of nodes for {leName}.
                    </CardDescription>
                </div>
                <div className="flex bg-white rounded-md shadow-sm border border-slate-200 p-0.5">
                    <Button
                        variant={viewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("table")}
                        className={`h-8 px-3 text-xs ${viewMode === "table" ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium" : "text-slate-500 font-normal hover:text-slate-700 hover:bg-slate-50"}`}
                    >
                        <TableIcon className="h-3.5 w-3.5 mr-1.5" />
                        Data Grid
                    </Button>
                    <Button
                        variant={viewMode === "spiderweb" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("spiderweb")}
                        className={`h-8 px-3 text-xs ${viewMode === "spiderweb" ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium" : "text-slate-500 font-normal hover:text-slate-700 hover:bg-slate-50"}`}
                    >
                        <Network className="h-3.5 w-3.5 mr-1.5" />
                        Spiderweb
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {viewMode === "table" ? (
                    <div className="p-6">
                        <KnowledgeGraphTable nodes={initialNodes} />
                    </div>
                ) : (
                    <div className="h-[650px] w-full bg-slate-50/50 rounded-b-xl border-t border-slate-100">
                        <EcosystemSpiderweb leName={leName} nodes={initialNodes} claims={claims} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
