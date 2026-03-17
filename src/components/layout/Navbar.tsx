"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

import { BRAND } from "@/config/brand";

import { usePathname } from "next/navigation";

export function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const navLinks = [
        { href: "/how-it-works", label: "How it Works" },
        { href: "/partner", label: "Partner" },
        { href: "/about", label: "About" },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-1">
                    <span className="text-2xl font-bold tracking-tight text-slate-900 font-sans flex items-baseline gap-1">
                        {BRAND.name}<span className="inline-block w-3 h-3 bg-amber-500" />
                    </span>
                </Link>

                <nav className="hidden gap-8 md:flex">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`relative py-2 text-sm font-medium transition-colors hover:text-slate-900 ${
                                    isActive ? "text-slate-900" : "text-slate-600"
                                }`}
                            >
                                {link.label}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-underline"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                                        initial={false}
                                    />
                                )}
                            </Link>
                        );
                    })}
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
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`text-lg font-medium transition-colors hover:text-slate-900 ${
                                                pathname === link.href ? "text-slate-900" : "text-slate-600"
                                            }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
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
