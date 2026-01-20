"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Upload, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getVaultDocuments, shareDocument, uploadDocument } from "@/actions/documents";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

interface VaultPickerProps {
    engagementId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function VaultPicker({ engagementId, isOpen, onClose }: VaultPickerProps) {
    const params = useParams();
    const router = useRouter();
    const leId = params.id as string; // From route /app/le/[id]/...

    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadUrl, setUploadUrl] = useState("");
    const [uploadName, setUploadName] = useState("");

    useEffect(() => {
        if (isOpen && leId) {
            loadVault();
        }
    }, [isOpen, leId]);

    const loadVault = async () => {
        setLoading(true);
        const res = await getVaultDocuments(leId);
        if (res.success && res.documents) {
            setDocuments(res.documents);
        }
        setLoading(false);
    };

    const handleShare = async (doc: any) => {
        // Optimistic / Loading state
        const toastId = toast.loading(`Sharing "${doc.name}"...`);

        const res = await shareDocument(doc.id, engagementId);

        if (res.success) {
            toast.success("Document shared", { id: toastId });
            router.refresh();
            onClose();
        } else {
            toast.error("Failed to share", { id: toastId });
        }
    };

    const handleUpload = async () => {
        if (!uploadUrl || !uploadName) return;
        setIsUploading(true);

        // 1. Upload to Vault
        const uploadRes = await uploadDocument(leId, {
            name: uploadName,
            type: "application/pdf", // Mock
            fileUrl: uploadUrl,
            docType: "GENERAL"
        });

        if (uploadRes.success && uploadRes.document) {
            // 2. Auto-share to Engagement
            await shareDocument(uploadRes.document.id, engagementId);
            toast.success("Uploaded & Shared");
            router.refresh();
            onClose();
            // Reset form
            setUploadUrl("");
            setUploadName("");
        } else {
            toast.error("Upload failed");
        }
        setIsUploading(false);
    };

    const filteredDocs = documents.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="p-6 pb-2 border-b">
                    <DialogHeader>
                        <DialogTitle>Select Authenticated Documents</DialogTitle>
                        <DialogDescription>
                            Choose verified documents from your customized Vault or upload new credentials.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="vault" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="vault">Search Vault</TabsTrigger>
                            <TabsTrigger value="upload">Upload New</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="vault" className="flex-1 flex flex-col min-h-0 mt-4">
                        <div className="px-6 mb-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search by name, type, or tag..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="px-6 pb-6 space-y-2">
                                {loading && (
                                    <div className="py-8 flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                    </div>
                                )}

                                {!loading && filteredDocs.length === 0 && (
                                    <div className="text-center py-12 text-slate-400">
                                        No documents found in vault.
                                    </div>
                                )}

                                {filteredDocs.map((doc) => {
                                    const isAlreadyShared = doc.sharedWith?.some((s: any) => s.id === engagementId);

                                    return (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-md bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                                                    <p className="text-xs text-slate-500">{doc.docType} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            {isAlreadyShared ? (
                                                <Button size="sm" variant="ghost" disabled className="text-emerald-600 bg-emerald-50">
                                                    <Check className="w-3 h-3 mr-1" /> Shared
                                                </Button>
                                            ) : (
                                                <Button size="sm" onClick={() => handleShare(doc)}>
                                                    Select
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="upload" className="flex-1 p-6">
                        <div className="border-2 border-dashed border-slate-200 rounded-xl h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <Upload className="h-6 w-6 text-slate-400" />
                            </div>
                            <h3 className="font-semibold text-slate-900 mb-1">Upload Credential</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-xs">
                                Drag and drop files here, or enter a URL for this demo.
                            </p>

                            <div className="w-full max-w-sm space-y-3">
                                <Input
                                    placeholder="Document Name (e.g. Cert of Inc)"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                />
                                <Input
                                    placeholder="File URL (https://...)"
                                    value={uploadUrl}
                                    onChange={(e) => setUploadUrl(e.target.value)}
                                />
                                <Button className="w-full" onClick={handleUpload} disabled={isUploading}>
                                    {isUploading ? "Uploading..." : "Add to Vault & Share"}
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
