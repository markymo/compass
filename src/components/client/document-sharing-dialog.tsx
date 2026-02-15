"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building2, Share2, Loader2, Users } from "lucide-react";
import { shareDocument, revokeDocumentAccess } from "@/actions/documents";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Engagement {
    id: string;
    org: {
        id: string;
        name: string;
        logoUrl?: string | null;
    };
}

interface DocumentSharingDialogProps {
    docId: string;
    docName: string;
    initialSharedWith: { id: string }[];
    allEngagements: Engagement[];
    onUpdate: () => void;
    trigger?: React.ReactNode;
}

export function DocumentSharingDialog({ docId, docName, initialSharedWith, allEngagements, onUpdate, trigger }: DocumentSharingDialogProps) {
    const [open, setOpen] = useState(false);
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    // Derive state from props (simple sync)
    const isShared = (engId: string) => initialSharedWith.some(share => share.id === engId);

    const handleToggle = async (engId: string, currentState: boolean) => {
        setLoadingMap(prev => ({ ...prev, [engId]: true }));
        try {
            let res;
            if (currentState) {
                res = await revokeDocumentAccess(docId, engId);
            } else {
                res = await shareDocument(docId, engId);
            }

            if (res.success) {
                toast.success(currentState ? "Access revoked" : "Document shared");
                onUpdate();
            } else {
                toast.error("Failed to update permissions");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setLoadingMap(prev => ({ ...prev, [engId]: false }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Share
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share Document</DialogTitle>
                    <DialogDescription>
                        Control which Financial Institutions can view <strong>{docName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {allEngagements.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg">
                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm">No active engagements found.</p>
                            <p className="text-xs">Start an engagement to share documents.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {allEngagements.map((eng) => {
                                const shared = isShared(eng.id);
                                const isLoading = loadingMap[eng.id];

                                return (
                                    <div key={eng.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border bg-white">
                                                <AvatarFallback className="text-xs font-bold text-indigo-700 bg-indigo-50">
                                                    {eng.org.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-sm text-slate-900">{eng.org.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {shared ? "Has Access" : "No Access"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                            <Switch
                                                checked={shared}
                                                onCheckedChange={() => handleToggle(eng.id, shared)}
                                                disabled={isLoading}
                                                className="data-[state=checked]:bg-indigo-600"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
