"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Brain, FileText, AlignLeft, Globe, Link as LinkIcon, Download, ExternalLink } from "lucide-react";
import { MockSource, SourceCategory, SourceType } from "./sources-v2-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GleifSourceDetail } from "./gleif-source-detail";
import { NationalRegistrySourceDetail } from "./national-registry-source-detail";

interface SourceDetailSheetProps {
    source: MockSource | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leId?: string;
    lei?: string | null;
    gleifData?: any;
    gleifFetchedAt?: Date | null;
}

export function SourceDetailSheet({ source, open, onOpenChange, leId, lei, gleifData, gleifFetchedAt }: SourceDetailSheetProps) {
    if (!source) return null;

    const getIconForType = (type: SourceType) => {
        switch (type) {
            case "Document": return <FileText className="h-5 w-5" />;
            case "Text": return <AlignLeft className="h-5 w-5" />;
            case "Web": return <Globe className="h-5 w-5" />;
        }
    };

    const mockExtractedData = [
        { label: "Registered Address", value: "123 Business Rd, London, UK", matchStr: "High" },
        { label: "Directors", value: "Jane Smith, John Doe", matchStr: "Medium" },
        { label: "Share Capital", value: "£1,000,000 GBP", matchStr: "High" },
        { label: "Operating Countries", value: "UK, France, Germany", matchStr: "Low" }
    ];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[600px] md:max-w-[700px] w-full p-0 flex flex-col bg-slate-50 overflow-hidden">
                <SheetHeader className="sr-only">
                    <SheetTitle>{source.name}</SheetTitle>
                    <SheetDescription>Details for {source.name}</SheetDescription>
                </SheetHeader>
                {source.id === "src-gleif" ? (
                    <GleifSourceDetail
                        source={source}
                        leId={leId}
                        lei={lei}
                        gleifData={gleifData}
                        gleifFetchedAt={gleifFetchedAt}
                    />
                ) : source.id === "src-registry" ? (
                    <NationalRegistrySourceDetail
                        source={source}
                        leId={leId}
                        lei={lei}
                        gleifData={gleifData}
                        gleifFetchedAt={gleifFetchedAt}
                    />
                ) : (
                    <>
                        {/* Header Section */}
                        <div className="bg-white border-b border-slate-200 p-6 shrink-0">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                                    {getIconForType(source.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-semibold text-slate-900 truncate" title={source.name}>
                                        {source.name}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                        <Badge variant="outline" className={cn(
                                            "font-normal border-slate-200",
                                            source.category === "Evidence" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                        )}>
                                            {source.category === "Evidence" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Brain className="h-3 w-3 mr-1" />}
                                            {source.category}
                                        </Badge>
                                        <span>•</span>
                                        <span>{source.uploadedAt}</span>
                                        <span>•</span>
                                        <span>{source.uploadedBy}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Section */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <Tabs defaultValue="preview" className="flex-1 flex flex-col w-full data-[state=active]:flex">
                                <div className="px-6 pt-4 bg-white border-b border-slate-200">
                                    <TabsList className="w-full justify-start bg-transparent h-10 p-0 border-b-0 space-x-6 rounded-none">
                                        <TabsTrigger value="preview" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                            Preview
                                        </TabsTrigger>
                                        <TabsTrigger value="extracted" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                            Extracted Data <Badge variant="secondary" className="ml-2 bg-slate-100">{source.fieldsExtracted}</Badge>
                                        </TabsTrigger>
                                        <TabsTrigger value="linked" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                            Linked Fields <Badge variant="secondary" className="ml-2 bg-slate-100">{source.linkedFields}</Badge>
                                        </TabsTrigger>
                                        <TabsTrigger value="metadata" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                            Metadata
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto w-full">
                                    <TabsContent value="preview" className="h-full m-0 p-6 flex flex-col">
                                        {source.type === "Document" && (
                                            <div className="flex-1 bg-slate-200 rounded-lg border border-slate-300 flex items-center justify-center flex-col gap-4">
                                                <FileText className="h-12 w-12 text-slate-400" />
                                                <p className="text-slate-500 font-medium">Document Preview Placeholder</p>
                                                <Button variant="outline" size="sm" className="bg-white"><Download className="h-4 w-4 mr-2" /> Download File</Button>
                                            </div>
                                        )}
                                        {source.type === "Text" && (
                                            <div className="flex-1 bg-white rounded-lg border border-slate-200 p-6 prose prose-sm max-w-none text-slate-700 shadow-sm">
                                                <p>This is placeholder text representing the content pasted or scraped for the source <strong>{source.name}</strong>. In a real implementation, this would contain the raw text that the extraction engine uses to identify facts and entities.</p>
                                                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                                            </div>
                                        )}
                                        {source.type === "Web" && (
                                            <div className="flex-1 bg-slate-200 rounded-lg border border-slate-300 flex items-center justify-center flex-col gap-4">
                                                <Globe className="h-12 w-12 text-slate-400" />
                                                <p className="text-slate-500 font-medium">Scraped Web Content Placeholder</p>
                                                <Button variant="outline" size="sm" className="bg-white"><ExternalLink className="h-4 w-4 mr-2" /> Visit URL</Button>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="extracted" className="m-0 p-6">
                                        {source.fieldsExtracted > 0 ? (
                                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3 font-medium">Fact / Field</th>
                                                            <th className="px-4 py-3 font-medium">Extracted Value</th>
                                                            <th className="px-4 py-3 font-medium text-right">Confidence</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {mockExtractedData.map((data: any, i: any) => (
                                                            <tr key={i} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 font-medium text-slate-900">{data.label}</td>
                                                                <td className="px-4 py-3 text-slate-600">{data.value}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[10px] font-medium uppercase border-none",
                                                                        data.matchStr === "High" ? "bg-emerald-100 text-emerald-700" :
                                                                            data.matchStr === "Medium" ? "bg-amber-100 text-amber-700" :
                                                                                "bg-red-100 text-red-700"
                                                                    )}>
                                                                        {data.matchStr}
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-slate-500 bg-white border border-dashed border-slate-200 rounded-lg">
                                                No data extracted yet.
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="linked" className="m-0 p-6">
                                        {source.linkedFields > 0 ? (
                                            <div className="space-y-4">
                                                {[mockExtractedData[0], mockExtractedData[1]].map((data: any, i: any) => (
                                                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center shadow-sm">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Source Fact</p>
                                                            <div className="font-medium text-slate-900">{data.label}</div>
                                                            <div className="text-sm text-slate-600 truncate max-w-[200px]">{data.value}</div>
                                                        </div>
                                                        <div className="px-4 text-slate-300">
                                                            <LinkIcon className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 pl-4 border-l border-slate-100">
                                                            <p className="text-xs text-indigo-500 uppercase tracking-wider font-semibold mb-1">Master Record</p>
                                                            <div className="font-medium text-slate-900">{data.label} (Schema ID)</div>
                                                            <div className="text-sm text-slate-600 truncate max-w-[200px]">Linked on Mar 5, 2024</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-slate-500 bg-white border border-dashed border-slate-200 rounded-lg">
                                                No Master Data fields linked to this source.
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="metadata" className="m-0 p-6">
                                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <div className="grid grid-cols-2 gap-y-4 p-5 text-sm">
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Source ID</p>
                                                    <p className="font-mono text-slate-900">{source.id}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Type</p>
                                                    <p className="text-slate-900">{source.type}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Category</p>
                                                    <p className="text-slate-900">{source.category}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Status</p>
                                                    <p className="text-slate-900">{source.status}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Uploaded At</p>
                                                    <p className="text-slate-900">{source.uploadedAt}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500">Uploaded By</p>
                                                    <p className="text-slate-900">{source.uploadedBy}</p>
                                                </div>
                                            </div>
                                            <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-lg flex justify-end">
                                                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                                                    Delete Source
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
