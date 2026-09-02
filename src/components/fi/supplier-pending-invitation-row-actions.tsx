"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MoreHorizontal, RefreshCw, Link as LinkIcon, Trash2, Loader2, Copy } from "lucide-react";
import { resendInvitation, generateNewInvitationLink, revokeInvitation } from "@/actions/invitations";

interface SupplierPendingInvitationRowActionsProps {
    invitation: {
        id: string;
        email: string;
        role: string;
        roleLabel: string;
        accessScope: string;
    };
    canManage: boolean;
}

export function SupplierPendingInvitationRowActions({ invitation, canManage }: SupplierPendingInvitationRowActionsProps) {
    const router = useRouter();
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [isRevokeOpen, setIsRevokeOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    if (!canManage) return null;

    const handleResend = async () => {
        setIsLoading(true);
        try {
            const res = await resendInvitation(invitation.id);
            if (res.success) {
                toast.success("Invitation email resent with a new valid link.");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to resend invitation");
            }
        } catch (err: any) {
            toast.error(err?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateLink = async () => {
        setIsLoading(true);
        try {
            const res = await generateNewInvitationLink(invitation.id);
            if (res.success && res.inviteLink) {
                setGeneratedLink(res.inviteLink);
                setIsLinkDialogOpen(true);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to generate link");
            }
        } catch (err: any) {
            toast.error(err?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async () => {
        setIsLoading(true);
        try {
            const res = await revokeInvitation(invitation.id);
            if (res.success) {
                toast.success("Invitation revoked");
                setIsRevokeOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to revoke invitation");
            }
        } catch (err: any) {
            toast.error(err?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyGeneratedLink = () => {
        navigator.clipboard.writeText(generatedLink);
        toast.success("New invitation link copied to clipboard");
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[11px] text-slate-500 font-semibold">
                        Invitation Actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleResend}
                        disabled={isLoading}
                        className="text-xs cursor-pointer gap-2"
                    >
                        <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                        Resend Invitation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={handleGenerateLink}
                        disabled={isLoading}
                        className="text-xs cursor-pointer gap-2"
                    >
                        <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                        Generate New Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setIsRevokeOpen(true)}
                        disabled={isLoading}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer gap-2"
                    >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        Revoke Invitation
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Generated New Link Dialog */}
            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>New Invitation Link</DialogTitle>
                        <DialogDescription>
                            A fresh invitation secret has been generated. Any previous link is now invalid.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Secure Link</Label>
                            <div className="flex gap-2">
                                <Input value={generatedLink} readOnly className="font-mono text-xs bg-slate-50 h-9" />
                                <Button variant="secondary" size="icon" onClick={copyGeneratedLink} className="h-9 w-9 shrink-0">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button size="sm" onClick={() => setIsLinkDialogOpen(false)} className="bg-teal-700 hover:bg-teal-800 text-white text-xs">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revoke Invitation Confirmation */}
            <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Revoke Invitation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revoke the invitation for {invitation.email}?
                            They will no longer be able to use this link to access OnPro.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsRevokeOpen(false)} className="text-xs">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleRevoke}
                            disabled={isLoading}
                            className="text-xs"
                        >
                            {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Revoke
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
