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
import { revokeDocumentAccess } from "@/actions/documents";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SharedDocument {
    id: string;
    name: string;
    fileType: string;
    docType: string | null;
    isVerified: boolean;
    createdAt: Date;
}

interface EvidenceDocument {
    id: string;
    name: string;
    fileUrl: string;
    fileType: string;
    kbSize: number | null;
    createdAt: Date;
}

interface EvidenceQuestion {
    id: string;
    text: string;
    compactText: string | null;
    answer: string | null;
    status: string;
    documents: EvidenceDocument[];
}

interface EngagementDocumentManagerProps {
    engagementId: string;
    documents: SharedDocument[];
    evidenceDocuments?: EvidenceQuestion[];
}

import { VaultPicker } from "./vault-picker";

const statusColors: Record<string, string> = {
    UNMAPPED: "bg-slate-100 text-slate-600 border-slate-200",
    DRAFT: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    SHARED: "bg-amber-50 text-amber-700 border-amber-200",
    RELEASED: "bg-green-50 text-green-700 border-green-200",
};

export function EngagementDocumentManager({ engagementId, documents, evidenceDocuments = [] }: EngagementDocumentManagerProps) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const router = useRouter();

    const totalEvidenceDocs = evidenceDocuments.reduce((acc: any, q: any) => acc + q.documents.length, 0);

    const handleRevoke = async (docId: string, docName: string) => {
        if (!confirm(`Revoke access to "${docName}"? The bank will no longer see this file.`)) return;
        const res = await revokeDocumentAccess(docId, engagementId);
        if (res.success) {
            toast.success("Access revoked");
            router.refresh();
        } else {
            toast.error("Failed to revoke access");
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="evidence" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
                        <p className="text-sm text-slate-500">Evidence attached to questions and files shared with this partner.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TabsList className="bg-slate-100 border border-slate-200">
                            <TabsTrigger value="evidence" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs gap-1.5">
                                <Paperclip className="h-3.5 w-3.5" />
                                Evidence
                                {totalEvidenceDocs > 0 && (
                                    <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                        {totalEvidenceDocs}
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
                        <Button size="sm" onClick={() => setIsPickerOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs">
                            <Plus className="h-3.5 w-3.5" />
                            Share from Vault
                        </Button>
                    </div>
                </div>

                {/* ─── Evidence Documents Tab ─── */}
                <TabsContent value="evidence" className="mt-0">
                    {evidenceDocuments.length === 0 ? (
                        <Card>
                            <CardContent>
                                <div className="text-center py-14">
                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                        <Paperclip className="h-6 w-6 text-slate-300" />
                                    </div>
                                    <h3 className="font-medium text-slate-900 mb-1">No evidence documents yet</h3>
                                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                        When you attach files to questions in the Workbench, they will appear here, grouped by question.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {evidenceDocuments.map((question: any) => (
                                <Card key={question.id} className="overflow-hidden border-slate-200 shadow-sm">
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
                                                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 italic border-l-2 border-indigo-200 pl-2">
                                                    {question.answer}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Documents for this Question */}
                                    <CardContent className="p-0">
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
                                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                <Download className="h-3.5 w-3.5" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ─── Shared Documents Tab ─── */}
                <TabsContent value="shared" className="mt-0">
                    <Card>
                        <CardContent className="p-0">
                            {documents.length === 0 ? (
                                <div className="text-center py-12">
                                    <ShieldCheck className="h-10 w-10 mx-auto text-indigo-200 mb-3" />
                                    <h3 className="font-medium text-slate-900">Digital Vault Secure</h3>
                                    <p className="text-slate-500 text-sm mb-4 max-w-sm mx-auto">
                                        No documents have been shared yet. Use the "Share from Vault" button to grant access to certified documents.
                                    </p>
                                    <Button variant="outline" onClick={() => setIsPickerOpen(true)}>
                                        Select Documents
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
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="gap-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRevoke(doc.id, doc.name)}>
                                                    <Trash2 className="h-4 w-4" /> Revoke
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <VaultPicker
                engagementId={engagementId}
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
            />
        </div>
    );
}
