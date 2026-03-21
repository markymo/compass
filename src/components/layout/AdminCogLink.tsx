"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminCogLink() {
    const pathname = usePathname();
    const isAdminActive = pathname.startsWith("/app/admin");

    return (
        <Button
            variant="ghost"
            size="icon"
            asChild
            className={cn(
                "relative shrink-0 transition-colors",
                isAdminActive
                    ? "text-amber-600 bg-amber-50 hover:bg-amber-100 hover:text-amber-700"
                    : "text-slate-500 hover:text-slate-900"
            )}
            title="System Administration"
        >
            <Link href="/app/admin">
                <Settings className={cn("h-5 w-5", isAdminActive && "animate-[spin_8s_linear_infinite]")} />
            </Link>
        </Button>
    );
}
