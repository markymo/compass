
import Link from "next/link";
import { Compass } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";

interface PlatformNavbarProps {
    orgName?: string;
    orgType?: string;
}

export function PlatformNavbar({ orgName, orgType }: PlatformNavbarProps) {
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
                            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                        >
                            Dashboard
                        </Link>

                        {orgType === "CLIENT" && (
                            <Link
                                href="/app/client"
                                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                            >
                                Client Area
                            </Link>
                        )}

                        {orgType === "FI" && (
                            <>
                                <Link
                                    href="/app/fi"
                                    className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/app/fi/questionnaires"
                                    className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                                >
                                    Questionnaires
                                </Link>
                            </>
                        )}

                        <Link
                            href="/app/admin"
                            className="text-sm font-medium text-amber-600 transition-colors hover:text-amber-700"
                        >
                            System Admin
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {orgName && (
                        <Badge variant="outline" className="text-sm px-3 py-1 bg-white/50">
                            {orgName} <span className="text-muted-foreground ml-1">({orgType})</span>
                        </Badge>
                    )}
                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        </header>
    );
}
