"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PlatformNavbarProps {
    orgName?: string;
    orgTypes?: string[];
}

export function PlatformNavbar({ orgName, orgTypes = [] }: PlatformNavbarProps) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === "/app") {
            return pathname === "/app" || pathname.startsWith("/app/le");
        }
        return pathname.startsWith(path);
    };

    return (
        <header className="sticky top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-8">
                    <Link href="/app" className="flex items-center gap-2">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white">
                            <Compass className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 font-serif">
                            COMPASS
                        </span>
                    </Link>

                    <nav className="hidden gap-6 md:flex">
                        <Link
                            href="/app"
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-slate-900",
                                isActive("/app") ? "text-slate-900" : "text-slate-500"
                            )}
                        >
                            Client Dashboard
                        </Link>


                        {orgTypes.includes("FI") && (
                            <Link
                                href="/app/fi"
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-slate-900",
                                    isActive("/app/fi") ? "text-slate-900" : "text-slate-500"
                                )}
                            >
                                FI Dashboard
                            </Link>
                        )}

                        {orgTypes.includes("SYSTEM") && (
                            <Link
                                href="/app/admin"
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-amber-700",
                                    isActive("/app/admin") ? "text-amber-600" : "text-amber-600/60"
                                )}
                            >
                                System Admin
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {orgName && (
                        <Badge variant="outline" className="text-sm px-3 py-1 bg-white/50">
                            {orgName} <span className="text-muted-foreground ml-1">({orgTypes.join(", ")})</span>
                        </Badge>
                    )}
                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        </header>
    );
}
