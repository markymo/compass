import { acceptInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

// This is a Public Page (outside (platform) layout)
export default async function InvitationPage({ params }: { params: { token: string } }) {
    const { token } = await params;
    const identity = await getIdentity();
    const userId = identity?.userId;

    // 1. validate token via action (dry run)
    // We can't really "dry run" nicely without a specific read-only method or reusing logic.
    // For simplicity, let's try to "Accept" and generic-handle the "Requires Auth" response.
    // BUT `acceptInvitation` is a mutation. We shouldn't call it on GET.
    // Refactor: We need a `getInvitationByToken` read-only action. 
    // For now, I'll inline the read logic here since it's a server component (secure).

    // START INLINE READ (Refactor to data layer later)
    const prisma = (await import("@/lib/prisma")).default;
    const invite = await prisma.invitation.findUnique({
        where: { token },
        include: { organization: true, clientLE: true }
    });
    // END INLINE READ

    if (!invite || invite.status !== "PENDING" || new Date() > invite.expiresAt) {
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

    // Determine correct action based on auth state
    const isLoggedIn = !!userId;

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
                        <CardTitle>You've been invited!</CardTitle>
                        <CardDescription>
                            Accept the invitation below to join <br />
                            <span className="font-semibold text-slate-900 text-lg">{invite.organization.name}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Invited Email:</span>
                                <span className="font-medium text-slate-900">{invite.email}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Role:</span>
                                <Badge variant="secondary">{invite.role}</Badge>
                            </div>
                            {invite.clientLE && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Access Scope:</span>
                                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                                        {invite.clientLE.name}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {!isLoggedIn && (
                            <div className="text-sm text-slate-500 text-center bg-yellow-50 p-3 rounded text-yellow-800 border border-yellow-100">
                                You must sign in with <strong>{invite.email}</strong> to accept this invitation.
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        {isLoggedIn ? (
                            <form action={async () => {
                                "use server";
                                const res = await acceptInvitation(token);
                                if (res.redirectUrl) redirect(res.redirectUrl);
                                if (res.error) {
                                    // In a real app we'd pass this error back to UI via separate client component
                                    // For now, redirecting to error or throwing simple error
                                    throw new Error(res.error);
                                }
                            }}>
                                <Button className="w-full gap-2 text-lg py-6" size="lg">
                                    Accept Invitation <ArrowRight className="w-5 h-5" />
                                </Button>
                            </form>
                        ) : (
                            <div className="w-full grid gap-3">
                                <Link href={`https://accounts.30ram6.com/sign-in?redirect_url=${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`}>
                                    <Button className="w-full gap-2" variant="default">
                                        Sign In to Accept
                                    </Button>
                                </Link>
                                <Link href={`https://accounts.30ram6.com/sign-up?redirect_url=${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`}>
                                    <Button className="w-full gap-2" variant="outline">
                                        Create Account
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
