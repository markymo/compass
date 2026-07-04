"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";
import { InviteSupplierDialog } from "./invite-supplier-dialog";
import { revokeInvitation } from "@/actions/invitations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

export interface EngagementTeamManagerProps {
    engagementId: string;
    orgName: string;
    members: any[];
    invitations: any[];
}

export function EngagementTeamManager({ engagementId, orgName, members, invitations }: EngagementTeamManagerProps) {
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [revokeId, setRevokeId] = useState<string | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);
    const router = useRouter();

    const confirmRevoke = async () => {
        if (!revokeId) return;
        setIsRevoking(true);
        toast.promise(revokeInvitation(revokeId), {
            loading: "Revoking invitation...",
            success: () => {
                router.refresh();
                setIsRevoking(false);
                setRevokeId(null);
                return "Invitation revoked";
            },
            error: () => {
                setIsRevoking(false);
                return "Failed to revoke invitation";
            }
        });
    };

    return (
        <div className="space-y-6">
            <ConfirmDeleteDialog
                open={!!revokeId}
                onOpenChange={(open) => { if (!open) setRevokeId(null); }}
                title="Revoke Invitation?"
                description="Are you sure you want to revoke this invitation?"
                onConfirm={confirmRevoke}
                isLoading={isRevoking}
                confirmLabel="Revoke"
            />
            {/* Active Members Card */}
            <Card>
                <CardHeader className="pb-3 border-b border-slate-100 mb-4">
                    <CardTitle className="text-lg text-slate-800">Active Team Members</CardTitle>
                    <CardDescription>Users who have access to this engagement.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {members.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">No active members found.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {members.map((member: any) => (
                                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                                            {member.user.name ? member.user.name.charAt(0).toUpperCase() : member.user.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{member.user.name || 'Unknown User'}</p>
                                            <p className="text-sm text-slate-500">{member.user.email}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">{member.role}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Invitations Card */}
            <Card>
                <CardHeader className="pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg text-slate-800">Pending Invitations</CardTitle>
                            <CardDescription>Invitations sent but not yet accepted.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setIsInviteDialogOpen(true)} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" /> Invite
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {invitations.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">No pending invitations.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {invitations.map((invite: any) => (
                                <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{invite.sentToEmail}</p>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                <Badge variant="outline" className="text-[10px] font-normal">{invite.role}</Badge>
                                                <span>•</span>
                                                <span>Sent by {invite.createdByUser?.name || invite.createdByUser?.email || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setRevokeId(invite.id)}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <InviteSupplierDialog
                open={isInviteDialogOpen}
                onOpenChange={setIsInviteDialogOpen}
                engagementId={engagementId}
                orgName={orgName}
            />
        </div>
    );
}
