"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { UserNav } from "./UserNav";
import { Button } from "@/components/ui/button";
import { DemoSwitcher } from "./DemoSwitcher";
import { AdminCogLink } from "./AdminCogLink";
import { AdminAppReturnLink } from "./AdminAppReturnLink";


interface PlatformNavbarProps {
    isSystemAdmin?: boolean;
    assignmentCount?: number;
}

import { BRAND } from "@/config/brand";

export function PlatformNavbar({ isSystemAdmin = false, assignmentCount = 0 }: PlatformNavbarProps) {
    const pathname = usePathname();
    const isAdminRoute = pathname?.startsWith("/app/admin");

    return (
        <header className={`sticky top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl transition-colors duration-200 ${isAdminRoute ? "bg-muted/90 text-foreground" : "bg-card/80 text-card-foreground"}`}>
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-1">
                            <img src="/logo.svg" alt={BRAND.name} className="h-10 w-auto dark:hidden" />
                            <img src="/logo-inverted.svg" alt={BRAND.name} className="h-10 w-auto hidden dark:block" />
                        </Link>
                        <AdminAppReturnLink />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground shrink-0 relative" title="My assigned tasks">
                        <Link href="/app/assignments">
                            <ClipboardCheck className="h-5 w-5" />
                            {assignmentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-[3px] text-[10px] font-bold leading-none bg-red-500 text-white rounded-full flex items-center justify-center">
                                    {assignmentCount > 99 ? '99+' : assignmentCount}
                                </span>
                            )}
                        </Link>
                    </Button>
                    {isSystemAdmin && <AdminCogLink />}
                    {isSystemAdmin && <DemoSwitcher />}
                    <UserNav />
                </div>
            </div>
        </header>
    );
}

