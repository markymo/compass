"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    FileText, Plus, Trash2, Eye, ShieldCheck, Clock,
    Paperclip, MessageSquare, Download, ChevronRight,
    FolderOpen
} from "lucide-react";
import { revokeDocumentAccess, shareDocument } from "@/actions/documents";
import { listLibraryDocumentsAction, DocumentPickerItem } from "@/actions/document-library-actions";
import { DocumentPicker } from "@/components/client/documents/DocumentPicker";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";
import { StandardTooltip } from "@/components/ui/standard-tooltip";

interface SharedDocument {
    id: string;
    name: string;
    fileType: string;
    docType: string | null;
    isVerified: boolean;
    createdAt: Date;
}

interface AttachedDocument {
    id: string;
    name: string;
    fileType: string;
    kbSize: number | null;
    createdAt: Date;
}

interface QuestionWithAttachments {
    id: string;
    text: string;
    compactText: string | null;
    answer: string | null;
    status: string;
    documents: AttachedDocument[];
}

interface EngagementDocumentManagerProps {
    engagementId: string;
    documents: SharedDocument[];
    evidenceDocuments?: QuestionWithAttachments[];
    clientLEId?: string;
    variant?: "default" | "inline";
}


const statusColors: Record<string, string> = {
    UNMAPPED: "bg-slate-100 text-slate-600 border-slate-200",
    DRAFT: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    SHARED: "bg-amber-50 text-amber-700 border-amber-200",
    RELEASED: "bg-green-50 text-green-700 border-green-200",
};

export function EngagementDocumentManager({ engagementId, documents, evidenceDocuments = [], clientLEId, variant = "default" }: EngagementDocumentManagerProps) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [libraryDocs, setLibraryDocs] = useState<DocumentPickerItem[] | null>(null);
    const [isFetchingDocs, setIsFetchingDocs] = useState(false);
    const [revokeDoc, setRevokeDoc] = useState<{ id: string; name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const totalAttachedDocs = evidenceDocuments.reduce((acc: any, q: any) => acc + q.documents.length, 0);

    const handleOpenPicker = async () => {
        setIsPickerOpen(true);
        if (clientLEId && !libraryDocs) {
            setIsFetchingDocs(true);
            try {
                const docs = await listLibraryDocumentsAction(clientLEId);
                setLibraryDocs(docs);
            } catch (err) {
                console.error("Failed to load documents", err);
            }
            setIsFetchingDocs(false);
        }
    };

    const handleSelectDocument = async (doc: DocumentPickerItem) => {
        setIsPickerOpen(false);
        toast.promise(shareDocument(doc.id, engagementId), {
            loading: `Sharing ${doc.fileName}...`,
            success: () => {
                router.refresh();
                return `Shared ${doc.fileName}`;
            },
            error: "Failed to share document"
        });
    };

    const handleRevokeConfirm = async () => {
        if (!revokeDoc) return;
        setIsLoading(true);
        const res = await revokeDocumentAccess(revokeDoc.id, engagementId);
        if (res.success) {
            toast.success("Access revoked");
            router.refresh();
        } else {
            toast.error("Failed to revoke access");
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-6">
            <ConfirmDeleteDialog
                open={!!revokeDoc}
                onOpenChange={(open) => { if (!open) setRevokeDoc(null); }}
                itemName={revokeDoc?.name}
                title="Revoke document access?"
                description={revokeDoc ? `The bank will no longer be able to access "${revokeDoc.name}".` : ""}
                confirmLabel="Revoke Access"
                onConfirm={handleRevokeConfirm}
                isLoading={isLoading}
            />
            <Tabs defaultValue="attachments" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
                        <p className="text-sm text-slate-500">Files attached to questions and shared with this partner.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TabsList className="bg-slate-100 border border-slate-200">
                            <TabsTrigger value="attachments" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs gap-1.5">
                                <Paperclip className="h-3.5 w-3.5" />
                                Attachments
                                {totalAttachedDocs > 0 && (
                                    <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                        {totalAttachedDocs}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="shared" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Shared
                                {documents.length > 0 && (
                                    <span className="ml-1 bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                        {documents.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenPicker}
                            className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </Button>
                    </div>
                </div>

                {/* ─── Question Attachments Tab ─── */}
                <TabsContent value="attachments" className="mt-0">
                    {evidenceDocuments.length === 0 ? (
                        variant === "inline" ? (
                            <div className="py-4 text-slate-500 text-sm">
                                No attached files yet. Files attached during question reviews appear here.
                            </div>
                        ) : (
                            <Card variant="structural">
                                <CardContent>
                                    <div className="text-center py-14">
                                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                            <Paperclip className="h-6 w-6 text-slate-300" />
                                        </div>
                                        <h3 className="font-medium text-slate-900 mb-1">No attached files yet</h3>
                                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                            When you attach files to questions during review, they will appear here, grouped by question.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    ) : (
                        <div className="space-y-4">
                            {evidenceDocuments.map((question: any) => (
                                <div key={question.id} className={cn("overflow-hidden border-slate-200 shadow-sm", variant === "inline" ? "border-b pb-3" : "border rounded-md")}>
                                    {/* Question Header */}
                                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-start gap-3">
                                        <div className="h-7 w-7 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-800 leading-snug">
                                                    {question.text}
                                                </p>
                                                <Badge className={cn("text-[10px] px-2 py-0.5 border shrink-0 font-normal", statusColors[question.status] || statusColors.DRAFT)}>
                                                    {question.status.replace(/_/g, " ")}
                                                </Badge>
                                            </div>
                                            {question.answer && (
                                                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 italic border-l-2 border-indigo-200 pl-2" title={typeof question.answer === 'object' ? JSON.stringify(question.answer) : String(question.answer)}>
                                                    {typeof question.answer === 'object' ? JSON.stringify(question.answer) : String(question.answer)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Documents for this Question */}
                                    <div className="p-0">
                                        <div className="divide-y divide-slate-100">
                                            {question.documents.map((doc: any) => (
                                                <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/70 group transition-colors">
                                                    <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                        <FileText className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                            <span className="uppercase">{doc.fileType}</span>
                                                            {doc.kbSize && <><span>•</span><span>{doc.kbSize} KB</span></>}
                                                            <span>•</span>
                                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                        </p>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" asChild>
                                                            <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                                                                <Download className="h-3.5 w-3.5" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ─── Shared Documents Tab ─── */}
                <TabsContent value="shared" className="mt-0">
                    {variant === "inline" ? (
                        documents.length === 0 ? (
                            <div className="py-4 text-slate-500 text-sm">
                                No documents have been shared yet. Use the "Add" button to grant access to certified documents.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {documents.map((doc: any) => (
                                    <div key={doc.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 group transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                                    {doc.name}
                                                    {doc.isVerified && (
                                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 h-5 px-1.5 gap-1">
                                                            <ShieldCheck className="w-3 h-3" /> Verified
                                                        </Badge>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                    <span>{doc.docType || "Document"}</span>
                                                    <span>•</span>
                                                    <span className="uppercase">{doc.fileType?.split('/')[1] || 'FILE'}</span>
                                                    <span>•</span>
                                                    <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <StandardTooltip content="Download Document">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" asChild>
                                                    <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" aria-label={`Download ${doc.name}`}>
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            </StandardTooltip>
                                            <Button variant="ghost" size="sm" className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                                                onClick={() => setRevokeDoc({ id: doc.id, name: doc.name })}>
                                                <Trash2 className="h-3.5 w-3.5" /> Revoke
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <Card variant="structural">
                            <CardContent className="p-0">
                                {documents.length === 0 ? (
                                    <div className="text-center py-12">
                                        <ShieldCheck className="h-10 w-10 mx-auto text-indigo-200 mb-3" />
                                        <h3 className="font-medium text-slate-900">Document Sharing Secure</h3>
                                        <p className="text-slate-500 text-sm mb-4 max-w-sm mx-auto">
                                            No documents have been shared yet. Use the "Add" button to grant access to certified documents.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleOpenPicker}
                                            className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {documents.map((doc: any) => (
                                            <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 group transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                                            {doc.name}
                                                            {doc.isVerified && (
                                                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 h-5 px-1.5 gap-1">
                                                                    <ShieldCheck className="w-3 h-3" /> Verified
                                                                </Badge>
                                                            )}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                            <span>{doc.docType || "Document"}</span>
                                                            <span>•</span>
                                                            <span className="uppercase">{doc.fileType?.split('/')[1] || 'FILE'}</span>
                                                            <span>•</span>
                                                            <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <StandardTooltip content="Download Document">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" asChild>
                                                            <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" aria-label={`Download ${doc.name}`}>
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    </StandardTooltip>
                                                    <Button variant="ghost" size="sm" className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                                                        onClick={() => setRevokeDoc({ id: doc.id, name: doc.name })}>
                                                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {isPickerOpen && (
                <DocumentPicker
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    documents={libraryDocs || []}
                    onSelect={handleSelectDocument}
                    disabledDocumentIds={documents.map(d => d.id)}
                    mode={{ type: "ADD" }}
                />
            )}
        </div>
    );
}

