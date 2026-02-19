"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass, Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

export function Navbar() {
    const { data: session } = useSession();
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-1">
                    <span className="text-2xl font-bold tracking-tight text-slate-900 font-sans flex items-baseline gap-1">
                        ONpro<span className="inline-block w-3 h-3 bg-amber-500" />
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

                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-900">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right">
                                <SheetHeader>
                                    <SheetTitle>Navigation Menu</SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col gap-6 mt-10">
                                    <Link
                                        href="/solutions"
                                        className="text-lg font-medium text-slate-600 transition-colors hover:text-slate-900"
                                    >
                                        Solutions
                                    </Link>
                                    <Link
                                        href="/how-it-works"
                                        className="text-lg font-medium text-slate-600 transition-colors hover:text-slate-900"
                                    >
                                        How it Works
                                    </Link>
                                    <Link
                                        href="/about"
                                        className="text-lg font-medium text-slate-600 transition-colors hover:text-slate-900"
                                    >
                                        About
                                    </Link>
                                    <hr className="border-slate-100 my-2" />
                                    {!session && (
                                        <Link
                                            href="/login"
                                            className="text-lg font-medium text-slate-600 transition-colors hover:text-slate-900"
                                        >
                                            Sign In
                                        </Link>
                                    )}
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    );
}
