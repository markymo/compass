"use client";

import { useState } from "react";
import { acceptInvitation } from "@/actions/accept-invitation";
import { registerUser } from "@/actions/auth-register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";

interface InvitationAcceptFlowProps {
    token: string;
    sentToEmail: string;
    isLoggedIn: boolean;
    userEmail?: string;
    scopeName?: string;
    role?: string;
}

export function InvitationAcceptFlow({ token, sentToEmail, isLoggedIn, userEmail, scopeName, role }: InvitationAcceptFlowProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Registration Form State
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");

    const isEmailMismatch = isLoggedIn && userEmail?.toLowerCase() !== sentToEmail.toLowerCase();

    const handleAccept = async () => {
        setIsLoading(true);
        setActionError(null);
        try {
            const res = await acceptInvitation(token);
            if (res.error) {
                setActionError(res.error);
            } else if (res.redirectUrl) {
                toast.success("Invitation accepted successfully!");
                router.push(res.redirectUrl);
            }
        } catch (e) {
            setActionError("An unexpected error occurred while accepting. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterAndAccept = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setActionError(null);
        
        try {
            // 1. Create account (Derive name from email prefix)
            const derivedName = sentToEmail.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
            const regResult = await registerUser({
                name: derivedName,
                email: sentToEmail,
                password,
                token
            });

            if (!regResult.success) {
                setActionError(regResult.error || "Failed to create account.");
                setIsLoading(false);
                return;
            }

            // 2. Sign In silently
            const signInResult = await signIn("credentials", {
                email: sentToEmail,
                password,
                redirect: false,
            });

            if (signInResult?.error) {
                setActionError("Account created, but automatic login failed. Please sign in.");
                setIsLoading(false);
                return;
            }

            // 3. Hard-redirect back to this invite page with ?autoAccept=1
            // We cannot call acceptInvitation() directly here because the new session
            // cookie isn't available to Server Actions until the next full request.
            // The page will re-render server-side with the live session and auto-accept.
            window.location.href = `/invite/${token}?autoAccept=1`;

        } catch (e) {
            setActionError("An unexpected error occurred during setup.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Error Display */}
            {actionError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex gap-3 text-red-800 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                    <div>
                        <div className="font-semibold text-red-900 mb-1">Could not process invitation</div>
                        {actionError}
                    </div>
                </div>
            )}

            {isLoggedIn ? (
                isEmailMismatch ? (
                    <div className="flex flex-col gap-3">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-sm text-amber-900 mb-2">
                            <p className="font-semibold text-base mb-1">Account Mismatch</p>
                            <p className="text-amber-700">You are currently signed in with a different account. Please sign out below to accept this invitation for <strong>{sentToEmail}</strong>.</p>
                        </div>
                        <Button 
                            variant="default" 
                            className="w-full gap-2 text-lg py-6 bg-slate-900" 
                            onClick={async () => {
                                await signOut({ redirect: false });
                                window.location.reload();
                            }}
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out to Continue
                        </Button>
                    </div>
                ) : (
                    <Button 
                        className="w-full gap-2 text-lg py-6" 
                        size="lg" 
                        onClick={handleAccept}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Accept Invitation"}
                        {!isLoading && <ArrowRight className="w-5 h-5" />}
                    </Button>
                )
            ) : (
                <div className="mt-2 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg text-sm text-emerald-900 mb-6 text-center">
                        <p className="font-semibold text-base mb-1">Thanks for accepting your invitation!</p>
                        <p className="text-emerald-700 mt-2">
                            We have securely set up an account for you to access {scopeName || "the platform"} as a <strong>{role || "Team Member"}</strong>.
                        </p>
                        <p className="text-emerald-700 mt-2">
                            <strong>Simply set your password below to continue.</strong>
                        </p>
                    </div>

                    <form onSubmit={handleRegisterAndAccept} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Create Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={isLoading}
                                className="bg-white"
                            />
                        </div>
                        
                        <Button type="submit" className="w-full h-12 text-md mt-6" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Set Password & Continue"}
                        </Button>
                    </form>

                    <div className="text-center text-xs text-slate-500 mt-4">
                        Already have an account?{" "}
                        <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="font-semibold underline hover:text-slate-900">
                            Sign in to your existing account
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
