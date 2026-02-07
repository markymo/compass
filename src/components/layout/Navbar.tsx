"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useSession } from "next-auth/react";

export function Navbar() {
    const { data: session } = useSession();
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-1">
                    <span className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
                        ONpro<span className="text-amber-500 text-3xl leading-none">.</span>
                    </span>
                </Link>

                <nav className="hidden gap-8 md:flex">
                    <Link
                        href="/solutions"
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                        Solutions
                    </Link>
                    <Link
                        href="/how-it-works"
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                        How it Works
                    </Link>
                    <Link
                        href="/about"
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                        About
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    {!session ? (
                        <>
                            <Link href="/login" className="hidden text-sm font-medium text-slate-900 transition-colors hover:text-slate-700 md:block">
                                Sign In
                            </Link>
                            <Button asChild variant="premium" size="sm">
                                <Link href="/login">
                                    Get Started
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <Button asChild variant="premium" size="sm">
                            <Link href="/app">
                                Go to App
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
