"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Plus,
    Search,
    FileText,
    Globe,
    AlignLeft,
    ShieldCheck,
    Brain,
    MoreVertical,
    CheckCircle2,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceDetailSheet } from "./source-detail-sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Mock Data
export type SourceCategory = "Evidence" | "Knowledge";
export type SourceType = "Document" | "Text" | "Web";

export interface MockSource {
    id: string;
    name: string;
    type: SourceType;
    category: SourceCategory;
    status: "Parsed" | "Processing" | "Failed";
    fieldsExtracted: number;
    linkedFields: number;
    uploadedAt: string;
    uploadedBy: string;
    isPinned?: boolean;
    identifyingNumber?: string;
}

const mockSources: MockSource[] = [
    {
        id: "src-gleif",
        name: "Global Legal Entity Identifier (GLEIF)",
        type: "Web",
        category: "Evidence",
        status: "Parsed",
        fieldsExtracted: 24,
        linkedFields: 10,
        uploadedAt: "Mar 5, 2024",
        uploadedBy: "System (Automated)",
        isPinned: true
    },
    {
        id: "src-registry",
        name: "National Registry (e.g., Companies House)",
        type: "Web",
        category: "Evidence",
        status: "Parsed",
        fieldsExtracted: 18,
        linkedFields: 12,
        uploadedAt: "Mar 5, 2024",
        uploadedBy: "System (Automated)",
        isPinned: true
    },
    {
        id: "src-1",
        name: "Articles_of_Association_2024.pdf",
        type: "Document",
        category: "Evidence",
        status: "Parsed",
        fieldsExtracted: 12,
        linkedFields: 5,
        uploadedAt: "Mar 5, 2024",
        uploadedBy: "Mark Mo"
    },
    {
        id: "src-2",
        name: "Corporate Description",
        type: "Text",
        category: "Knowledge",
        status: "Parsed",
        fieldsExtracted: 3,
        linkedFields: 2,
        uploadedAt: "Mar 4, 2024",
        uploadedBy: "Jane Doe"
    },
    {
        id: "src-3",
        name: "Company Website (About Us)",
        type: "Web",
        category: "Knowledge",
        status: "Parsed",
        fieldsExtracted: 18,
        linkedFields: 8,
        uploadedAt: "Mar 3, 2024",
        uploadedBy: "System"
    },
    {
        id: "src-4",
        name: "Q3_Financial_Statement.xlsx",
        type: "Document",
        category: "Evidence",
        status: "Processing",
        fieldsExtracted: 0,
        linkedFields: 0,
        uploadedAt: "Mar 5, 2024",
        uploadedBy: "Mark Mo"
    }
];

export function SourcesV2Client({
    leId,
    leName,
    lei,
    gleifData,
    gleifFetchedAt
}: {
    leId: string;
    leName: string;
    lei?: string | null;
    gleifData?: any;
    gleifFetchedAt?: Date | null;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<string>("All");

    // Mock sources state (allows removal)
    const [sources, setSources] = useState<MockSource[]>(mockSources);

    // UI State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<MockSource | null>(null);

    // Derived Data
    const parsedGleif = gleifData?.attributes || gleifData?.data?.[0]?.attributes || gleifData;
    const gleifEntity = parsedGleif?.entity || {};
    const registrationAuthorityName = gleifData?.registrationAuthorityName;
    const registrationAuthorityEntityID = gleifEntity.registeredAs;
    const leiValue = parsedGleif?.lei || lei;

    const displaySources = sources.map(source => {
        if (source.id === "src-gleif" && leiValue) {
            return {
                ...source,
                identifyingNumber: leiValue
            };
        }
        if (source.id === "src-registry" && registrationAuthorityName && registrationAuthorityName !== "Unknown Registry") {
            return {
                ...source,
                name: registrationAuthorityName !== "Unknown (Click 'Sync Registry')" ? registrationAuthorityName : source.name,
                identifyingNumber: registrationAuthorityEntityID || undefined
            };
        }
        return source;
    });

    const filteredSources = displaySources.filter(source => {
        if (searchQuery && !source.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

        switch (filter) {
            case "Documents": return source.type === "Document";
            case "Text": return source.type === "Text";
            case "Web": return source.type === "Web";
            case "Evidence": return source.category === "Evidence";
            case "Knowledge": return source.category === "Knowledge";
            default: return true;
        }
    });

    // Make sure pinned sources are always at the top
    const sortedSources = [...filteredSources].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Optionally sort by date here if not pinned
        return 0;
    });

    const getIconForType = (type: SourceType) => {
        switch (type) {
            case "Document": return <FileText className="h-4 w-4" />;
            case "Text": return <AlignLeft className="h-4 w-4" />;
            case "Web": return <Globe className="h-4 w-4" />;
        }
    };

    const getIconForCategory = (category: SourceCategory) => {
        switch (category) {
            case "Evidence": return <ShieldCheck className="h-3 w-3 mr-1" />;
            case "Knowledge": return <Brain className="h-3 w-3 mr-1" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Sources Workspace</h2>
                    <p className="text-sm text-slate-500">
                        Manage all origins of truth for {leName}.
                    </p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Add Source
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
                    {["All", "Documents", "Text", "Web", "Evidence", "Knowledge"].map((f) => (
                        <Button
                            key={f}
                            variant={filter === f ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "rounded-full whitespace-nowrap",
                                filter === f ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500"
                            )}
                            onClick={() => setFilter(f)}
                        >
                            {f === "Evidence" && <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-blue-500" />}
                            {f === "Knowledge" && <Brain className="h-3.5 w-3.5 mr-1.5 text-purple-500" />}
                            {f}
                        </Button>
                    ))}
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search sources..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-md text-sm focus:ring-1 focus:ring-slate-300 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Library List */}
            <div className="flex flex-col gap-4">
                {sortedSources.map((source) => (
                    <Card
                        key={source.id}
                        className={cn(
                            "hover:border-indigo-300 transition-colors cursor-pointer group",
                            source.isPinned ? "border-amber-200 bg-amber-50/10 shadow-sm" : ""
                        )}
                        onClick={() => setSelectedSource(source)}
                    >
                        <CardContent className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            {/* Left Side: Icon & Title */}
                            <div className="flex items-center gap-4 flex-1 w-full">
                                <div className={cn(
                                    "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
                                    source.isPinned ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                )}>
                                    {getIconForType(source.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate" title={source.name}>
                                            {source.name}
                                        </h3>
                                        {source.identifyingNumber && (
                                            <Badge variant="outline" className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0 h-5">
                                                {source.identifyingNumber}
                                            </Badge>
                                        )}
                                        {source.isPinned && (
                                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-1.5 py-0 h-5">
                                                Pinned Registry
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                        <Badge variant="outline" className={cn(
                                            "font-normal border-slate-200",
                                            source.category === "Evidence" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                        )}>
                                            {getIconForCategory(source.category)}
                                            {source.category}
                                        </Badge>
                                        <span className="hidden md:inline">•</span>
                                        <span>{source.uploadedAt} by {source.uploadedBy}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Stats & Status */}
                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                                <div className="flex gap-4 text-xs text-slate-600">
                                    <div className="flex flex-col items-center md:items-end">
                                        <span className="font-semibold text-slate-900">{source.fieldsExtracted}</span>
                                        <span className="text-slate-500">Facts Extracted</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                                    <div className="flex flex-col items-center md:items-end">
                                        <span className="font-semibold text-slate-900">{source.linkedFields}</span>
                                        <span className="text-slate-500">Master Links</span>
                                    </div>
                                </div>

                                <div className="min-w-[100px] flex justify-end">
                                    {source.status === "Parsed" ? (
                                        <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
                                            <div className="h-3 w-3 rounded-full border-2 border-amber-600 border-t-transparent animate-spin mr-0.5"></div>
                                            Processing
                                        </div>
                                    )}
                                </div>

                                {source.isPinned ? (
                                    <div className="h-8 w-8 shrink-0 hidden md:block" />
                                ) : (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <MoreVertical className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (source.linkedFields > 0) {
                                                        toast.error(`Cannot remove source. It is linked to ${source.linkedFields} master data field(s).`);
                                                        return;
                                                    }
                                                    setSources(prev => prev.filter(s => s.id !== source.id));
                                                    toast.success("Source removed successfully");
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Remove Source
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredSources.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-500 mb-2">No sources found matching your criteria.</p>
                    <Button variant="outline" onClick={() => { setFilter("All"); setSearchQuery(""); }}>
                        Clear Filters
                    </Button>
                </div>
            )}

            <AddSourceDialog
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                leId={leId}
            />

            <SourceDetailSheet
                source={selectedSource}
                open={!!selectedSource}
                onOpenChange={(open: boolean) => !open && setSelectedSource(null)}
                leId={leId}
                lei={lei}
                gleifData={gleifData}
                gleifFetchedAt={gleifFetchedAt}
            />
        </div>
    );
}
