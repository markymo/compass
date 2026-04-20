"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, MapPin, Database } from "lucide-react";

interface KnowledgeGraphTableProps {
    nodes: any[];
}

export function KnowledgeGraphTable({ nodes }: KnowledgeGraphTableProps) {
    const people = nodes.filter(n => n.nodeType === "PERSON");
    const entities = nodes.filter(n => n.nodeType === "LEGAL_ENTITY");
    const addresses = nodes.filter(n => n.nodeType === "ADDRESS");

    const renderTable = (data: any[]) => {
        if (data.length === 0) {
            return (
                <div className="rounded-md border border-slate-200 p-12 text-center text-slate-500 text-sm">
                    No nodes found in this category.
                </div>
            );
        }

        return (
            <div className="rounded-md border border-slate-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[120px] font-semibold text-slate-600">Type</TableHead>
                            <TableHead className="font-semibold text-slate-600">Name / Identifier</TableHead>
                            <TableHead className="w-[150px] font-semibold text-slate-600">Source</TableHead>
                            <TableHead className="w-[150px] font-semibold text-slate-600">Last Modified</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((node) => {
                            let label = "Unknown Node";
                            let icon = "⚪";
                            let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";

                            if (node.nodeType === 'PERSON') {
                                label = `${node.person?.firstName || ''} ${node.person?.lastName || ''}`.trim() || 'Unknown Person';
                                icon = "👤";
                                badgeStyle = "bg-cyan-50 text-cyan-700 border-cyan-200";
                            } else if (node.nodeType === 'LEGAL_ENTITY') {
                                label = node.legalEntity?.name || node.legalEntity?.localRegistrationNumber || 'Unknown Entity';
                                icon = "🏢";
                                badgeStyle = "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200";
                            } else if (node.nodeType === 'ADDRESS') {
                                label = [node.address?.line1, node.address?.city, node.address?.country].filter(Boolean).join(', ') || 'Unknown Address';
                                icon = "📍";
                                badgeStyle = "bg-orange-50 text-orange-700 border-orange-200";
                            }

                            return (
                                <TableRow key={node.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors group">
                                    <TableCell>
                                        <Badge variant="outline" className={`${badgeStyle} shadow-sm font-medium px-2 py-0.5 text-[10px]`}>
                                            {icon} {node.nodeType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                        {label}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center text-xs text-slate-500">
                                            {node.source === 'UNKNOWN' ? 'User Assigned' : node.source}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400">
                                        {new Date(node.updatedAt).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Tabs defaultValue="all" className="w-full">
            <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="all" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                        <Database className="h-3.5 w-3.5 mr-1.5" />
                        All Nodes ({nodes.length})
                    </TabsTrigger>
                    <TabsTrigger value="people" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        People ({people.length})
                    </TabsTrigger>
                    <TabsTrigger value="entities" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                        <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        Entities ({entities.length})
                    </TabsTrigger>
                    <TabsTrigger value="addresses" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                        Addresses ({addresses.length})
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="all" className="min-h-[400px]">
                {renderTable(nodes)}
            </TabsContent>

            <TabsContent value="people" className="min-h-[400px]">
                {renderTable(people)}
            </TabsContent>

            <TabsContent value="entities" className="min-h-[400px]">
                {renderTable(entities)}
            </TabsContent>

             <TabsContent value="addresses" className="min-h-[400px]">
                {renderTable(addresses)}
            </TabsContent>
        </Tabs>
    );

}
