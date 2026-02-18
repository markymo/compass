"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { toast } from "sonner";
import { registerUser } from "@/actions/auth-register";

function RegisterForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Auto-fill from invite context
    const callbackUrl = searchParams.get("callbackUrl") || "/app";
    const prefilledEmail = searchParams.get("email") || "";

    // Attempt to extract token from callbackUrl (e.g. /invite/TOKEN)
    // This allows us to auto-verify the email if the registration is part of an invite flow
    const tokenMatch = callbackUrl.match(/\/invite\/([a-zA-Z0-9-]+)/);
    const inviteToken = tokenMatch ? tokenMatch[1] : undefined;

    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState(prefilledEmail);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Create Account
            const result = await registerUser({
                name,
                email,
                password,
                token: inviteToken
            });

            if (!result.success) {
                toast.error(result.error || "Failed to create account");
                setIsLoading(false);
                return;
            }

            toast.success("Account created successfully!");

            // 2. Auto Login
            const signInResult = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (signInResult?.error) {
                toast.error("Account created, but failed to sign in automatically.");
                router.push("/login?email=" + encodeURIComponent(email));
            } else {
                router.push(callbackUrl);
                router.refresh();
            }

        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center flex flex-col items-center">
                <div className="mb-4 flex flex-col items-center">
                    <span className="text-4xl font-bold tracking-tight text-slate-900 font-sans">
                        ONpro<span className="text-amber-500 text-5xl leading-none">.</span>
                    </span>
                </div>
                <CardTitle className="text-2xl font-sans font-bold">Create an account</CardTitle>
                <CardDescription>
                    {inviteToken ? "Register to accept your invitation" : "Get started with Compass"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading || !!prefilledEmail} // Lock if pre-filled for security context
                            className={prefilledEmail ? "bg-slate-100 text-slate-500" : ""}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            disabled={isLoading}
                        />
                    </div>
                    <Button type="submit" className="w-full h-10" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Account
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="flex justify-center text-xs text-muted-foreground flex-col gap-2">
                <p>
                    Already have an account?{" "}
                    <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="underline hover:text-primary">
                        Sign in
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}

export default function RegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-slate-300" />}>
                <RegisterForm />
            </Suspense>
        </div>
    );
}
