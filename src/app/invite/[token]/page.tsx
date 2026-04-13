import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { InvitationAcceptFlow } from "@/components/client/invitation-accept-flow";
import { acceptInvitation } from "@/actions/accept-invitation";

// This is a Public Page (outside (platform) layout)
export default async function InvitationPage({ params, searchParams }: { params: { token: string }, searchParams: { autoAccept?: string } }) {
    const { token } = await params;
    const sp = await searchParams;
    const autoAccept = sp?.autoAccept === "1";
    const identity = await getIdentity();
    const userId = identity?.userId;
    const userEmail = identity?.email || undefined;

    // 1. Hash Token for Lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Fetch Invitation — cast to any to handle new polymorphic fields (Prisma client cache lag)
    const invite = await (prisma.invitation.findUnique as any)({
        where: { tokenHash },
        include: {
            organization: { select: { name: true } },
            clientLE: { select: { name: true } },
            fiEngagement: {
                include: {
                    org: true,
                    clientLE: true
                }
            }
        }
    }) as any;

    // 3. Validate
    const isValid = invite && !invite.revokedAt && !invite.usedAt && new Date() < invite.expiresAt;

    if (!isValid || !invite) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md border-red-200 bg-red-50">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <CardTitle className="text-red-900">Invalid Invitation</CardTitle>
                        <CardDescription className="text-red-700">
                            This invitation link is invalid, expired, or has already been used.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Link href="/">
                            <Button variant="outline" className="border-red-200 hover:bg-red-100 text-red-900">Return Home</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Determine context display based on scope type
    const isLoggedIn = !!userId;

    // Auto-Accept: if user just registered and was redirected back here, complete the flow silently.
    if (autoAccept && isLoggedIn) {
        const acceptRes = await acceptInvitation(token);
        if (acceptRes.success && acceptRes.redirectUrl) {
            redirect(acceptRes.redirectUrl);
        }
        // If it fails (e.g. already used), fall through and show the normal page.
    }

    const orgName =
        invite.organization?.name ??
        invite.fiEngagement?.org?.name ??
        "Your Organization";
    const clientLEName =
        invite.clientLE?.name ??
        invite.fiEngagement?.clientLE?.name ??
        null;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Logo / Header */}
                <div className="text-center">
                    <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
                        Join the Team
                    </h2>
                </div>

                <Card className="border-slate-200 shadow-lg">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto bg-indigo-50 p-3 rounded-full w-fit mb-4">
                            <Building2 className="w-8 h-8 text-indigo-600" />
                        </div>
                        <CardTitle className="text-2xl">Welcome to {orgName}!</CardTitle>
                        <CardDescription className="text-base mt-2">
                            You've been invited to access the platform.
                        </CardDescription>

                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Invited Email:</span>
                                <span className="font-medium text-slate-900">{invite.sentToEmail}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Role:</span>
                                <Badge variant="secondary">{invite.role}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Access Scope:</span>
                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                                    {clientLEName}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <div className="w-full">
                            <InvitationAcceptFlow
                                token={token}
                                sentToEmail={invite.sentToEmail}
                                isLoggedIn={isLoggedIn}
                                userEmail={userEmail}
                                scopeName={orgName}
                                role={invite.role}
                            />
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
