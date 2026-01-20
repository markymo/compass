"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, ExternalLink, Trash2, Eye, ShieldCheck, Clock } from "lucide-react";
import { revokeDocumentAccess } from "@/actions/documents";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Document {
    id: string;
    name: string;
    fileType: string;
    docType: string | null;
    isVerified: boolean;
    createdAt: Date;
}

interface EngagementDocumentManagerProps {
    engagementId: string;
    documents: Document[];
}

import { VaultPicker } from "./vault-picker";

export function EngagementDocumentManager({ engagementId, documents }: EngagementDocumentManagerProps) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const router = useRouter();

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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Shared Documents</h2>
                    <p className="text-sm text-slate-500">Files securely shared with this partner.</p>
                </div>
                <Button onClick={() => setIsPickerOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Share from Vault
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {documents.length === 0 ? (
                        <div className="text-center py-12">
                            <ShieldCheck className="h-10 w-10 mx-auto text-indigo-200 mb-3" />
                            <h3 className="font-medium text-slate-900">Digital Vault Secure</h3>
                            <p className="text-slate-500 text-sm mb-4 max-w-sm mx-auto">
                                No documents have been shared yet. Use the button above to grant access to certified documents from your Vault.
                            </p>
                            <Button variant="outline" onClick={() => setIsPickerOpen(true)}>
                                Select Documents
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {documents.map((doc) => (
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
                                                <span className="uppercase">{doc.fileType.split('/')[1] || 'FILE'}</span>
                                                <span>•</span>
                                                <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-indigo-600">
                                            <Eye className="h-4 w-4" /> View
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRevoke(doc.id, doc.name)}
                                        >
                                            <Trash2 className="h-4 w-4" /> Revoke
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <VaultPicker
                engagementId={engagementId}
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
            />
        </div>
    );
}
