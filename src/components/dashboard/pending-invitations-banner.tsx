"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Loader2, Building2 } from "lucide-react";
import { claimPendingInvitation } from "@/actions/invitations";

interface PendingInvitationItem {
    id: string;
    role: string;
    organization?: { id: string; name: string } | null;
    clientLE?: { id: string; name: string } | null;
    fiEngagement?: {
        id: string;
        fiOrgId: string;
        clientLE?: { id: string; name: string } | null;
        org?: { id: string; name: string } | null;
    } | null;
}

export function PendingInvitationsBanner({ invitations }: { invitations: PendingInvitationItem[] }) {
    const router = useRouter();
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!invitations || invitations.length === 0) return null;

    const handleClaim = async (id: string) => {
        setClaimingId(id);
        setError(null);
        try {
            const res = await claimPendingInvitation(id);
            if (res.success && res.redirectUrl) {
                router.push(res.redirectUrl);
            } else {
                setError(res.error || "Failed to accept invitation");
                setClaimingId(null);
            }
        } catch (err: any) {
            setError(err?.message || "An unexpected error occurred");
            setClaimingId(null);
        }
    };

    return (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-white shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                    <Mail className="h-5 w-5 text-indigo-600" />
                    <CardTitle className="text-lg font-semibold text-slate-900">
                        Pending Invitations
                    </CardTitle>
                </div>
                <CardDescription className="text-slate-600">
                    You have been invited to collaborate. Accept your invitation to access the workspace.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {error && (
                    <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-600 border border-rose-200">
                        {error}
                    </div>
                )}
                {invitations.map((inv) => {
                    let title = "Collaboration";
                    let subtitle = "";
                    let roleDisplay = inv.role;

                    if (inv.fiEngagement) {
                        title = `${inv.fiEngagement.clientLE?.name || "Client"} — ${inv.fiEngagement.org?.name || "Supplier"}`;
                        subtitle = "Relationship Team";
                        roleDisplay = inv.role === "RELATIONSHIP_ADMIN" ? "Relationship Admin" : "Relationship User";
                    } else if (inv.clientLE) {
                        title = inv.clientLE.name;
                        subtitle = "Client Legal Entity";
                    } else if (inv.organization) {
                        title = inv.organization.name;
                        subtitle = "Organisation";
                    }

                    const isClaiming = claimingId === inv.id;

                    return (
                        <div
                            key={inv.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200/80 shadow-xs gap-3"
                        >
                            <div className="flex items-start space-x-3">
                                <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 mt-0.5">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-medium text-slate-900 text-sm">{title}</span>
                                        <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
                                            {roleDisplay}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-slate-500">{subtitle}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 sm:self-center">
                                <Button
                                    size="sm"
                                    onClick={() => handleClaim(inv.id)}
                                    disabled={isClaiming || claimingId !== null}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 h-8"
                                >
                                    {isClaiming ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                            Accepting...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                            Accept Invitation
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
