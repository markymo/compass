"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PlatformNavLinksProps {
    orgTypes?: string[];
}

export function PlatformNavLinks({ orgTypes = [] }: PlatformNavLinksProps) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === "/app") {
            return pathname === "/app" || pathname.startsWith("/app/le");
        }
        return pathname.startsWith(path);
    };

    return (
        <nav className="hidden gap-6 md:flex">
            <Link
                href="/app/v2"
                className={cn(
                    "text-sm font-medium transition-all px-3 py-2 rounded-md",
                    isActive("/app/v2")
                        ? "bg-slate-100 text-slate-900 border-b-2 border-slate-300"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
            >
                My Compass
            </Link>

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
    );
}
