import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { updateMembershipRole, removeMembership } from "@/actions/memberships";
import { resendInvitation, revokeInvitation, updateInvitationRole } from "@/actions/invitations";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

export type UserAccessRow = {
    kind: "membership" | "invitation";
    id: string;
    email: string;
    role: "ORG_ADMIN" | "ORG_MEMBER";
    status: "ACTIVE" | "PENDING";
    scopeType: "ORG";
    scopeId: string;
    scopeName: string;
};

interface UserAccessModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: UserAccessRow | null;
    onSuccess: () => void;
}

export function UserAccessModal({ open, onOpenChange, user, onSuccess }: UserAccessModalProps) {
    const [updatingRole, setUpdatingRole] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [resending, setResending] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);

    if (!user) return null;

    const isInvite = user.kind === "invitation";

    async function handleRoleChange(newRole: string) {
        setUpdatingRole(true);
        try {
            const res = isInvite 
                ? await updateInvitationRole(user!.id, newRole)
                : await updateMembershipRole(user!.id, newRole);

            if (res.success) {
                toast.success("Role updated successfully.");
                onSuccess();
                // We don't close the modal immediately so they can see the change, 
                // but the parent might update the `user` prop.
            } else {
                toast.error(res.error || "Failed to update role.");
            }
        } catch (e) {
            toast.error("An unexpected error occurred.");
        } finally {
            setUpdatingRole(false);
        }
    }

    async function handleRemove() {
        setRemoving(true);
        try {
            const res = isInvite
                ? await revokeInvitation(user!.id)
                : await removeMembership(user!.id);

            if (res.success) {
                toast.success(isInvite ? "Invitation revoked." : "Access removed.");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Failed to remove access.");
            }
        } catch (e) {
            toast.error("An unexpected error occurred.");
        } finally {
            setRemoving(false);
            setConfirmRemove(false);
        }
    }

    async function handleResendInvite() {
        setResending(true);
        try {
            const res = await resendInvitation(user!.id);
            if (res.success) {
                toast.success("Invitation resent successfully.");
                onSuccess();
            } else {
                toast.error(res.error || "Failed to resend invitation.");
            }
        } catch (e) {
            toast.error("An unexpected error occurred.");
        } finally {
            setResending(false);
        }
    }

    async function handleSendWelcomeEmail() {
        setSendingEmail(true);
        // Stub for now
        setTimeout(() => {
            toast.success("Welcome email sent.");
            setSendingEmail(false);
        }, 1000);
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) setConfirmRemove(false);
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isInvite ? "Manage Invitation" : "Manage User Access"}</DialogTitle>
                    <DialogDescription>
                        Update roles, manage communication, or remove access.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* User Info Header */}
                    <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="mt-0.5">
                            <Mail className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <div className="font-medium text-slate-900">{user.email}</div>
                            <div className="text-sm text-slate-500 mt-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Status:</span>
                                    <Badge variant="outline" className={user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                        {user.status === "ACTIVE" ? "Active" : "Pending invite"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Scope:</span>
                                    <span>Organization: {user.scopeName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Access Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900">Access</h4>
                        <div className="flex items-center gap-3">
                            <Select value={user.role} onValueChange={handleRoleChange} disabled={updatingRole}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ORG_MEMBER">Member (Limited access)</SelectItem>
                                    <SelectItem value="ORG_ADMIN">Admin (Full control)</SelectItem>
                                </SelectContent>
                            </Select>
                            {updatingRole && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
                        </div>
                    </div>

                    {/* Communication Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900">Communication</h4>
                        {isInvite ? (
                            <Button variant="outline" className="w-full justify-start" onClick={handleResendInvite} disabled={resending}>
                                {resending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                                Resend invite
                            </Button>
                        ) : (
                            <Button variant="outline" className="w-full justify-start" onClick={handleSendWelcomeEmail} disabled={sendingEmail}>
                                {sendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                                Send welcome email
                            </Button>
                        )}
                    </div>

                    {/* Danger Zone */}
                    <div className="space-y-3 pt-2 border-t border-red-100">
                        <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> Danger Zone
                        </h4>
                        
                        <Button variant="destructive" className="w-full justify-start" onClick={() => setConfirmRemove(true)}>
                            {isInvite ? "Revoke invite" : "Remove access"}
                        </Button>
                        <ConfirmDeleteDialog
                            open={confirmRemove}
                            onOpenChange={setConfirmRemove}
                            title={isInvite ? "Revoke invite?" : "Remove access?"}
                            description={isInvite 
                                ? "Are you sure you want to revoke this invite? They will no longer be able to join." 
                                : "Are you sure you want to remove this user's access? They will immediately lose access to this organization."}
                            onConfirm={handleRemove}
                            isLoading={removing}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
