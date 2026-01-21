"use client";

import { Document } from "@prisma/client";
import { File, MoreVertical, Trash2, Download, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { deleteDocument } from "@/actions/vault-actions";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface VaultListProps {
    documents: Document[];
    clientLEId: string;
}

export function VaultList({ documents, clientLEId }: VaultListProps) {

    const handleDelete = async (docId: string, docName: string) => {
        if (!confirm(`Are you sure you want to delete "${docName}"?\nThis cannot be undone.`)) return;

        const res = await deleteDocument(docId, clientLEId);
        if (res.success) {
            toast.success("Document deleted");
        } else {
            toast.error("Failed to delete document");
        }
    };

    if (documents.length === 0) {
        return (
            <div className="text-center py-12 border rounded-xl bg-slate-50/50">
                <p className="text-slate-500 text-sm">No documents found. Upload one above.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {documents.map((doc) => (
                <div key={doc.id} className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-100 transition-all">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 p-2.5 rounded-lg">
                                <File className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="flex flex-col">
                                <a href={doc.fileUrl} target="_blank" className="font-medium text-slate-800 text-sm hover:underline decoration-slate-300 underline-offset-2 truncate max-w-[180px]" title={doc.name}>
                                    {doc.name}
                                </a>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                    <span>{doc.kbSize ? `${doc.kbSize} KB` : 'Unknown size'}</span>
                                    <span>•</span>
                                    <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                                </div>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 group-hover:text-slate-600">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(doc.fileUrl, '_blank')}>
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(doc.id, doc.name)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            ))}
        </div>
    );
}
