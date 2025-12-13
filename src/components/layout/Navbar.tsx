"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function Navbar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white">
                        <Compass className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-900 font-serif">
                        COMPASS
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
                    <SignedOut>
                        <Link href="/login" className="hidden text-sm font-medium text-slate-900 transition-colors hover:text-slate-700 md:block">
                            Sign In
                        </Link>
                    </SignedOut>
                    <SignedIn>
                        <Link href="/app" className="hidden text-sm font-medium text-slate-900 transition-colors hover:text-slate-700 md:block">
                            Go to App
                        </Link>
                    </SignedIn>
                    <Button variant="premium" size="sm" className="">
                        Request Access
                    </Button>
                </div>
            </div>
        </header>
    );
}
