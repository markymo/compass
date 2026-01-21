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
import { getVaultDocuments, uploadDocument, deleteDocument } from "@/actions/documents";
import { getLEEngagements } from "@/actions/client-le";
import { DocumentSharingDialog } from "./document-sharing-dialog";
import {
    FileText, MoreVertical, Search, Upload, Download, Trash2, Loader2, File, ShieldCheck, Clock,
    LayoutGrid, List as ListIcon, Filter, FolderOpen, Building2
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
            loadDocuments();
        } else {
            toast.error("Failed to delete document");
        }
    };

    const FilterButton = ({ type, label, icon: Icon }: { type: FilterType, label: string, icon: any }) => (
        <Button
            variant={activeFilter === type ? "secondary" : "ghost"}
            className={cn("w-full justify-start", activeFilter === type && "font-semibold")}
            onClick={() => setActiveFilter(type)}
        >
            <Icon className="mr-2 h-4 w-4" />
            {label}
            {activeFilter === type && (
                <span className="ml-auto text-xs opacity-60 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                    {type === 'ALL'
                        ? documents.length
                        : type === 'SHARED'
                            ? documents.filter(d => d.sharedWith?.length > 0).length
                            : documents.filter(d => d.docType === type).length
                    }
                </span>
            )}
        </Button>
    );

    return (
        <div className="flex h-[600px] -m-6 rounded-b-xl overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-1">
                <div className="mb-4 px-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">My Vault</h3>
                </div>

                <FilterButton type="ALL" label="All Documents" icon={FolderOpen} />
                <FilterButton type="SHARED" label="Shared with FIs" icon={Building2} />

                <div className="my-2 px-2">
                    <div className="h-px bg-slate-200 dark:bg-slate-700 mx-2" />
                </div>

                <div className="mb-2 px-2 mt-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">File Type</h3>
                </div>

                <FilterButton type="CORPORATE" label="Corporate" icon={FileText} />
                <FilterButton type="IDENTITY" label="Identity" icon={File} />
                <FilterButton type="FINANCIAL" label="Financial" icon={FileText} />
                <FilterButton type="OTHER" label="Other" icon={File} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
                {/* Toolbar */}
                <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search documents..."
                                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 mr-2">
                            <Button
                                variant={viewMode === 'list' ? 'outline' : 'ghost'}
                                size="sm"
                                className={cn("h-7 w-7 p-0", viewMode === 'list' && "bg-white shadow-sm")}
                                onClick={() => setViewMode('list')}
                            >
                                <ListIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'outline' : 'ghost'}
                                size="sm"
                                className={cn("h-7 w-7 p-0", viewMode === 'grid' && "bg-white shadow-sm")}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        <UploadDocumentDialog leId={leId} onSuccess={loadDocuments} />
                    </div>
                </div>

                {/* File Area */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed h-full flex flex-col items-center justify-center">
                            <div className="bg-slate-100 dark:bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center mb-4">
                                <FileText className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No documents found</h3>
                            <p className="text-slate-500 mb-6 max-w-sm">
                                {searchQuery ? "Try adjusting your search or filters." : "Upload documents to get started."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'grid' ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {filteredDocs.map((doc) => (
                                        <Card key={doc.id} className="group hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg">
                                                        <File className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <DocumentActions doc={doc} onDelete={handleDelete} />
                                                </div>

                                                <div className="mb-4">
                                                    <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm" title={doc.name}>
                                                        {doc.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-400">{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                                    <DocStatusBadge verified={doc.isVerified} />
                                                    <DocumentSharingDialog
                                                        docId={doc.id}
                                                        docName={doc.name}
                                                        initialSharedWith={doc.sharedWith || []}
                                                        allEngagements={engagements}
                                                        onUpdate={loadDocuments}
                                                    />
                                                </div>
                                                {doc.sharedWith?.length > 0 && <SharedWithAvatars sharedWith={doc.sharedWith} leId={leId} className="mt-2" />}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>Client Document</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Date Added</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Sharing</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDocs.map((doc) => (
                                                <TableRow key={doc.id} className="group">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-slate-100 p-2 rounded">
                                                                <FileText className="h-4 w-4 text-slate-600" />
                                                            </div>
                                                            {doc.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-normal text-[10px]">
                                                            {doc.docType?.replace(/_/g, " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-slate-500">{format(new Date(doc.createdAt), "MMM d, yyyy")}</TableCell>
                                                    <TableCell>
                                                        <DocStatusBadge verified={doc.isVerified} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <DocumentSharingDialog
                                                                docId={doc.id}
                                                                docName={doc.name}
                                                                initialSharedWith={doc.sharedWith || []}
                                                                allEngagements={engagements}
                                                                onUpdate={loadDocuments}
                                                            />
                                                            <SharedWithAvatars sharedWith={doc.sharedWith} leId={leId} />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DocumentActions doc={doc} onDelete={handleDelete} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Subcomponents ---

function DocStatusBadge({ verified }: { verified: boolean }) {
    if (verified) {
        return (
            <div className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                <ShieldCheck className="w-3 h-3" />
                <span className="font-medium">Verified</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
        </div>
    );
}

import Link from "next/link";

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

function DocumentActions({ doc, onDelete }: { doc: any, onDelete: (id: string) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open(doc.fileUrl, '_blank')}>
                    <Download className="mr-2 h-4 w-4" /> Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => onDelete(doc.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
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
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
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
