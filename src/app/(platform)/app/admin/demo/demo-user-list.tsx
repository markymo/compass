"use client";

import { Button } from "@/components/ui/button";
import { generateImpersonationToken } from "@/actions/demo-actions";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react"; // Theater icon might not be available in lucide-react version installed
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DemoUserProps {
    users: any[];
}

export function DemoUserList({ users }: DemoUserProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleImpersonate = async (userId: string) => {
        if (loadingId) return;
        setLoadingId(userId);

        try {
            console.log("Requesting impersonation token for", userId);
            const result = await generateImpersonationToken(userId);

            if (!result.success || !result.token) {
                console.error("Token generation failed:", result.error);
                toast.error(result.error || "Failed to generate impersonation token");
                setLoadingId(null);
                return;
            }

            console.log("Token received, signing in...");

            const signInResult = await signIn("credentials", {
                token: result.token,
                callbackUrl: "/app",
                redirect: false
            });

            if (signInResult?.error) {
                toast.error("Sign in failed");
                setLoadingId(null);
            } else {
                // Manually redirect on success
                window.location.href = "/app";
            }
        } catch (error) {
            console.error("Impersonation error", error);
            toast.error("An unexpected error occurred");
            setLoadingId(null);
        }
    };

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <UserCheck className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No Demo Actors Found</h3>
                <p className="text-slate-500 max-w-sm text-center mt-2">
                    Please run the seed script to create demo accounts with the <code>isDemoActor</code> flag.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
                <Card key={user.id} className="overflow-hidden border-amber-100 shadow-sm hover:shadow-md transition-all group">
                    <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4 relative">
                        <div className="flex justify-between items-start mb-2">
                            <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-inner">
                                <UserCheck className="h-5 w-5" />
                            </div>
                            {loadingId === user.id && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
                        </div>
                        <CardTitle className="text-lg font-sans font-semibold text-slate-900">{user.name}</CardTitle>
                        <p className="text-sm text-slate-500 font-mono text-xs mt-1">{user.email}</p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="mb-6 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Context & Roles</p>
                            <div className="flex flex-wrap gap-2">
                                {user.memberships.length > 0 ? user.memberships.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-100 bg-slate-50 text-xs font-medium text-slate-700 w-full">
                                        <div className={`h-2 w-2 rounded-full ${m.organization?.types?.includes('FI') ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                        <span className="flex-1 truncate">{m.organization?.name || "Unknown Org"}</span>
                                        <span className="text-slate-400 px-1 border-l border-slate-200 ml-1">{m.role}</span>
                                    </div>
                                )) : (
                                    <span className="text-xs text-slate-400 italic">No memberships assigned</span>
                                )}
                            </div>
                        </div>

                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium"
                            onClick={() => handleImpersonate(user.id)}
                            disabled={!!loadingId}
                        >
                            {loadingId === user.id ? "Connecting..." : "Impersonate Actor"}
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
