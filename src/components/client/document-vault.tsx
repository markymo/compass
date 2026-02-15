"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getVaultDocuments, uploadDocument, deleteDocument } from "@/actions/documents";
import { analyzeDocument } from "@/actions/document-analysis";
import { getLEEngagements } from "@/actions/client-le";
import { DocumentSharingDialog } from "./document-sharing-dialog";
import {
    FileText, MoreVertical, Search, Upload, Download, Trash2, Loader2, File, ShieldCheck, Clock,
    LayoutGrid, List as ListIcon, Filter, FolderOpen, Building2, Eye, Bot, Database, Sparkles, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { upload } from "@vercel/blob/client";
import Link from "next/link";

interface DocumentVaultProps {
    leId: string;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'ALL' | 'CORPORATE' | 'IDENTITY' | 'FINANCIAL' | 'OTHER' | 'SHARED';

export function DocumentVault({ leId }: DocumentVaultProps) {
    const [documents, setDocuments] = useState<any[]>([]);
    const [engagements, setEngagements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const [docRes, engRes] = await Promise.all([
                getVaultDocuments(leId),
                getLEEngagements(leId)
            ]);

            if (docRes.success && docRes.documents) {
                setDocuments(docRes.documents);
            } else {
                toast.error("Failed to load documents");
            }

            if (engRes.success && engRes.engagements) {
                setEngagements(engRes.engagements);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load vault data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [leId]);

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.docType?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'SHARED') return doc.sharedWith && doc.sharedWith.length > 0;
        return doc.docType === activeFilter;
    });

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        const res = await deleteDocument(id);
        if (res.success) {
            toast.success("Document deleted");
            if (selectedDoc?.id === id) {
                setIsSheetOpen(false);
                setSelectedDoc(null);
            }
            loadDocuments();
        } else {
            toast.error("Failed to delete document");
        }
    };

    const handleDocClick = (doc: any) => {
        setSelectedDoc(doc);
        setIsSheetOpen(true);
    };

    const FilterPill = ({ type, label, icon: Icon }: { type: FilterType, label: string, icon: any }) => (
        <Button
            variant={activeFilter === type ? "default" : "outline"}
            size="sm"
            className={cn(
                "rounded-full h-8 px-4 text-xs font-medium transition-all",
                activeFilter === type
                    ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-md"
                    : "text-slate-600 bg-white hover:bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
            )}
            onClick={() => setActiveFilter(type)}
        >
            <Icon className="mr-2 h-3.5 w-3.5" />
            {label}
            <span className={cn(
                "ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20",
                activeFilter !== type && "bg-slate-100 text-slate-500 dark:bg-slate-800"
            )}>
                {type === 'ALL'
                    ? documents.length
                    : type === 'SHARED'
                        ? documents.filter(d => d.sharedWith?.length > 0).length
                        : documents.filter(d => d.docType === type).length
                }
            </span>
        </Button>
    );

    return (
        <div className="flex flex-col h-[700px] w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Header / Toolbar */}
            <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-sm">
                            <ShieldCheck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Digital Vault</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Secure storage & knowledge base</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search documents..."
                                className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white transition-all text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <Button
                                variant={viewMode === 'list' ? 'outline' : 'ghost'}
                                size="sm"
                                className={cn("h-7 w-7 p-0 rounded-md", viewMode === 'list' && "bg-white shadow-sm")}
                                onClick={() => setViewMode('list')}
                            >
                                <ListIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'outline' : 'ghost'}
                                size="sm"
                                className={cn("h-7 w-7 p-0 rounded-md", viewMode === 'grid' && "bg-white shadow-sm")}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        <UploadDocumentDialog leId={leId} onSuccess={loadDocuments} />
                    </div>
                </div>

                <div className="flex items-center overflow-x-auto pb-1 -mb-1 hide-scrollbar">
                    <div className="flex space-x-2">
                        <FilterPill type="ALL" label="All" icon={FolderOpen} />
                        <FilterPill type="CORPORATE" label="Corporate" icon={FileText} />
                        <FilterPill type="IDENTITY" label="Identity" icon={File} />
                        <FilterPill type="FINANCIAL" label="Financial" icon={FileText} />
                        <FilterPill type="SHARED" label="Shared" icon={Building2} />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/50 dark:bg-slate-900/10">
                {loading ? (
                    <div className="flex justify-center flex-col items-center gap-4 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <p className="text-sm text-slate-500">Accessing secure vault...</p>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full max-h-[400px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 p-8 text-center">
                        <div className="bg-slate-100 dark:bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No documents found</h3>
                        <p className="text-slate-500 mb-6 max-w-sm text-sm">
                            {searchQuery ? "Try adjusting your search or filters." : "Upload documents to the secure vault to get started."}
                        </p>
                        {!searchQuery && <UploadDocumentDialog leId={leId} onSuccess={loadDocuments} />}
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid gap-4 min-[450px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pb-20">
                                {filteredDocs.map((doc) => {
                                    const aiData = doc.metadata?.extractedKnowledge;
                                    return (
                                        <div
                                            key={doc.id}
                                            className="group cursor-pointer h-full"
                                            onClick={() => handleDocClick(doc)}
                                        >
                                            <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-700 relative overflow-hidden">
                                                {aiData && (
                                                    <div className="absolute top-0 right-0 p-1.5 bg-indigo-500/10 rounded-bl-xl border-l border-b border-indigo-100 dark:border-indigo-900/50 backdrop-blur-sm">
                                                        <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                )}
                                                <CardContent className="p-4 flex flex-col h-full">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className={cn(
                                                            "p-2.5 rounded-lg transition-colors",
                                                            doc.docType === 'FINANCIAL' ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" :
                                                                doc.docType === 'IDENTITY' ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100" :
                                                                    "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                                                        )}>
                                                            <File className="h-6 w-6" />
                                                        </div>
                                                        <DocStatusBadge verified={doc.isVerified} mini />
                                                    </div>

                                                    <div className="mb-2 flex-1">
                                                        <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm" title={doc.name}>
                                                            {doc.name}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {aiData?.documentType ? (
                                                                <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate max-w-full" title={aiData.documentType}>
                                                                    {aiData.documentType}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{doc.docType}</span>
                                                            )}
                                                            <span className="text-[10px] text-slate-300">•</span>
                                                            <span className="text-[10px] text-slate-400">{(doc.kbSize || 120) + ' KB'}</span>
                                                        </div>
                                                        {aiData?.summary && (
                                                            <p className="text-[10px] text-slate-500 mt-2 line-clamp-2 leading-relaxed bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                {aiData.summary}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                                                        <span className="text-xs text-slate-400">{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                                                        {doc.sharedWith?.length > 0 && (
                                                            <div className="flex -space-x-1">
                                                                {doc.sharedWith.slice(0, 3).map((s: any) => (
                                                                    <div key={s.id} className="w-4 h-4 rounded-full bg-slate-200 border border-white" title={s.org.name} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[40%]">Document Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Date Added</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDocs.map((doc) => {
                                            const aiData = doc.metadata?.extractedKnowledge;
                                            return (
                                                <TableRow
                                                    key={doc.id}
                                                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 group transition-colors"
                                                    onClick={() => handleDocClick(doc)}
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "p-2 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors",
                                                                doc.docType === 'FINANCIAL' ? "group-hover:bg-emerald-50 group-hover:text-emerald-600" :
                                                                    doc.docType === 'IDENTITY' ? "group-hover:bg-blue-50 group-hover:text-blue-600" : ""
                                                            )}>
                                                                {aiData ? <Sparkles className="h-4 w-4 text-indigo-500" /> : <FileText className="h-4 w-4" />}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                                                    {doc.name}
                                                                    {aiData && (
                                                                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-indigo-200 text-indigo-600 bg-indigo-50">
                                                                            AI ENRICHED
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                    {(doc.kbSize || 120) + ' KB'}
                                                                    {doc.sharedWith?.length > 0 && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-indigo-500">Shared with {doc.sharedWith.length} orgs</span>
                                                                        </>
                                                                    )}
                                                                    {aiData?.summary && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-slate-500 max-w-[300px] truncate" title={aiData.summary}>
                                                                                {aiData.summary}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {aiData?.documentType ? (
                                                            <Badge variant="secondary" className="font-normal text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100">
                                                                {aiData.documentType}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="font-normal text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">
                                                                {doc.docType?.replace(/_/g, " ")}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-xs font-medium">
                                                        {format(new Date(doc.createdAt), "MMM d, yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DocStatusBadge verified={doc.isVerified} />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Document Details Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto p-0 gap-0 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
                    {selectedDoc && (
                        <div className="flex flex-col h-full">
                            {/* Decorative Header Background */}
                            <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0 relative">
                                <div className="absolute -bottom-8 left-6 p-1 bg-white dark:bg-slate-950 rounded-xl shadow-sm">
                                    <div className="h-14 w-14 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-indigo-600">
                                        <File className="h-8 w-8" />
                                    </div>
                                </div>
                                <Button
                                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border-0"
                                    size="icon"
                                    onClick={() => setIsSheetOpen(false)}
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex-1 px-6 pt-10 pb-6 overflow-y-auto">
                                <div className="mb-6">
                                    <SheetTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
                                        {selectedDoc.name}
                                    </SheetTitle>
                                    <SheetDescription className="flex items-center flex-wrap gap-2 text-sm text-slate-500">
                                        <Badge variant="outline" className="font-normal">{selectedDoc.docType}</Badge>
                                        <span>•</span>
                                        <span>{format(new Date(selectedDoc.createdAt), "PPP")}</span>
                                        <span>•</span>
                                        <span>{(selectedDoc.kbSize || 120) + ' KB'}</span>
                                    </SheetDescription>
                                </div>

                                <Separator className="my-6" />

                                <div className="space-y-8">

                                    {/* Knowledge Base Extraction Section (New Feature) */}
                                    <section className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-md text-purple-600 dark:text-purple-400">
                                                <Sparkles className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Knowledge Extraction</h3>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                                Our AI engine can parse this document to extract entities, dates, obligations, and relationship data to automatically build your knowledge base.
                                            </p>
                                            <KnowledgeExtraction doc={selectedDoc} />
                                        </div>
                                    </section>

                                    {/* Actions Section */}
                                    <section className="space-y-3">
                                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Actions</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button className="w-full text-slate-700 dark:text-slate-300" variant="outline" onClick={() => window.open(selectedDoc.fileUrl, '_blank')}>
                                                <Download className="mr-2 h-4 w-4" /> Download
                                            </Button>
                                            <Button className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" variant="outline" onClick={() => handleDelete(selectedDoc.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </Button>
                                        </div>
                                    </section>

                                    {/* Shared With Section */}
                                    <section className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Shared Access</h3>
                                            <DocumentSharingDialog
                                                docId={selectedDoc.id}
                                                docName={selectedDoc.name}
                                                initialSharedWith={selectedDoc.sharedWith || []}
                                                allEngagements={engagements}
                                                onUpdate={loadDocuments}
                                                trigger={
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                                        Manage Access
                                                    </Button>
                                                }
                                            />
                                        </div>

                                        {selectedDoc.sharedWith && selectedDoc.sharedWith.length > 0 ? (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                                {selectedDoc.sharedWith.map((share: any, i: number) => (
                                                    <div key={share.id} className={cn(
                                                        "flex items-center justify-between p-3",
                                                        i !== 0 && "border-t border-slate-100 dark:border-slate-800"
                                                    )}>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8 text-[10px]">
                                                                <AvatarFallback className="bg-slate-100 text-slate-700">{share.org.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <span className="text-sm font-medium block">{share.org.name}</span>
                                                                <span className="text-[10px] text-slate-500">Full Access</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-100">Active</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-center border border-dashed border-slate-200">
                                                Not shared with any organization
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

// --- Subcomponents ---

// AI Knowledge Extraction Component
function KnowledgeExtraction({ doc }: { doc: any }) {
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [knowledge, setKnowledge] = useState<any>(null);

    // Initial load: check if document already has knowledge
    useEffect(() => {
        if (doc.metadata && doc.metadata.extractedKnowledge) {
            setKnowledge(doc.metadata.extractedKnowledge);
            setStatus('done');
        } else {
            setStatus('idle');
            setKnowledge(null);
        }
    }, [doc]);

    const handleExtract = async () => {
        setStatus('processing');
        try {
            const res = await analyzeDocument(doc.id);
            if (res.success && res.knowledge) {
                setKnowledge(res.knowledge);
                setStatus('done');
                toast.success("Knowledge extracted successfully");
            } else {
                setStatus('idle');
                toast.error(res.error || "Analysis failed");
            }
        } catch (e) {
            console.error(e);
            setStatus('idle');
            toast.error("Analysis failed");
        }
    };

    if (status === 'done' && knowledge) {
        return (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg">
                    <span className="flex items-center gap-2 text-xs font-medium text-green-700">
                        <ShieldCheck className="h-4 w-4" /> Analyzed & Verified
                    </span>
                    <Badge variant="outline" className="text-[10px] border-green-200 text-green-700 bg-white">AI Confidence: High</Badge>
                </div>

                <div className="space-y-2">
                    {/* Summary */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Concept Summary</span>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {knowledge.summary || "No summary available."}
                        </p>
                    </div>

                    {/* Entities */}
                    {knowledge.entities && knowledge.entities.length > 0 && (
                        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm text-xs space-y-2">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Key Entities</span>
                            <div className="flex gap-2 flex-wrap">
                                {knowledge.entities.map((e: any, i: number) => (
                                    <div key={i} className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                                        <Building2 className="w-3 h-3 mr-1 opacity-50" />
                                        <span className="font-medium mr-1">{e.name}</span>
                                        <span className="text-[9px] opacity-70">({e.role})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dates & Facts Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {knowledge.dates && knowledge.dates.map((d: any, i: number) => (
                            <div key={`d-${i}`} className="p-2 bg-white rounded border border-slate-200 text-xs">
                                <span className="text-slate-400 block mb-0.5 text-[10px] uppercase">{d.label}</span>
                                <span className="font-medium text-slate-900">{d.date}</span>
                            </div>
                        ))}
                        {knowledge.keyFacts && knowledge.keyFacts.map((f: any, i: number) => (
                            <div key={`f-${i}`} className="p-2 bg-white rounded border border-slate-200 text-xs">
                                <span className="text-slate-400 block mb-0.5 text-[10px] uppercase">{f.label}</span>
                                <span className="font-medium text-slate-900">{f.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Provenance Footer */}
                    <div className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                        <Database className="w-3 h-3" />
                        <span>Source: {doc.name} (v1.0)</span>
                    </div>
                </div>

                <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={handleExtract}>
                    <Sparkles className="w-3 h-3 mr-2" /> Re-analyze Document
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {status === 'processing' ? (
                <div className="flex items-center justify-center p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        <span className="text-xs text-indigo-600 font-medium animate-pulse">Reading document & extracting knowledge...</span>
                    </div>
                </div>
            ) : (
                <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                    onClick={handleExtract}
                >
                    <Bot className="w-4 h-4 mr-2" />
                    Extract Knowledge to System
                </Button>
            )}
        </div>
    );
}

function DocStatusBadge({ verified, mini }: { verified: boolean, mini?: boolean }) {
    if (verified) {
        return (
            <div className={cn(
                "flex items-center gap-1 text-[10px] text-green-700 bg-green-50/50 border border-green-200",
                mini ? "p-1 rounded-md" : "px-2 py-0.5 rounded-full"
            )}>
                <ShieldCheck className="w-3 h-3" />
                {!mini && <span className="font-medium">Verified</span>}
            </div>
        );
    }
    return (
        <div className={cn(
            "flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50/50 border border-slate-200",
            mini ? "p-1 rounded-md" : "px-2 py-0.5 rounded-full"
        )}>
            <Clock className="w-3 h-3" />
            {!mini && <span>Pending</span>}
        </div>
    );
}

function SharedWithAvatars({ sharedWith, leId, limit = 4, className }: { sharedWith: any[], leId: string, limit?: number, className?: string }) {
    if (!sharedWith || sharedWith.length === 0) return null;

    return (
        <div className={cn("flex items-center -space-x-2", className)}>
            {sharedWith.slice(0, limit).map((share: any) => (
                <Link key={share.id} href={`/app/le/${leId}/engagement-new/${share.id}?tab=documents`} title={`Shared with ${share.org.name}`}>
                    <Avatar className="h-6 w-6 border-2 border-white ring-1 ring-slate-100 cursor-pointer hover:ring-indigo-300 transition-all">
                        <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700 font-bold">
                            {share.org.name.substring(0, 1)}
                        </AvatarFallback>
                    </Avatar>
                </Link>
            ))}
            {sharedWith.length > limit && (
                <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[9px] text-slate-500 font-medium">
                    +{sharedWith.length - limit}
                </div>
            )}
        </div>
    );
}

function UploadDocumentDialog({ leId, onSuccess }: { leId: string, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setUploadProgress(10);

        try {
            const formData = new FormData(e.currentTarget);
            const file = formData.get("file") as File;
            const docName = formData.get("name") as string;
            const docType = formData.get("docType") as string;

            if (!file) return;

            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/upload',
            });

            setUploadProgress(80);

            const res = await uploadDocument(leId, {
                name: docName || file.name,
                type: file.type || "application/pdf",
                fileUrl: newBlob.url,
                docType: docType,
                kbSize: Math.round(file.size / 1024)
            });

            if (res.success) {
                toast.success("Document uploaded successfully");
                setOpen(false);
                onSuccess();
            } else {
                toast.error(res.error || "Failed to save document metadata");
            }

        } catch (error) {
            console.error(error);
            toast.error("Upload failed. Check console for details.");
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                        <DialogDescription>Add a document to your secure digital vault.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Document Name</Label>
                            <Input id="name" name="name" placeholder="e.g. Certificate of Incorporation" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="docType">Document Type</Label>
                            <Select name="docType" defaultValue="CORPORATE">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CORPORATE">Corporate Governance</SelectItem>
                                    <SelectItem value="IDENTITY">Identity Proof</SelectItem>
                                    <SelectItem value="FINANCIAL">Financial Statement</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="file">File</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept=".pdf,.docx,.jpg,.png"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {loading ? `Uploading ${uploadProgress > 0 ? uploadProgress + '%' : ''}` : 'Upload Document'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

