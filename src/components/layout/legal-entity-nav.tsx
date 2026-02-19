"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Database,
    Library,
    Users,
    Clipboard,
    Link2
} from "lucide-react";

interface LegalEntityNavProps {
    leId: string;
}

export function LegalEntityNav({ leId }: LegalEntityNavProps) {
    const pathname = usePathname();
    const baseUrl = `/app/le/${leId}`;

    const tabs = [
        {
            label: "Overview",
            href: baseUrl,
            icon: LayoutDashboard,
            // Active if exact match or just base url (handling trailing slash potentially)
            isActive: (path: string) => path === baseUrl || path === `${baseUrl}/`
        },
        {
            label: "Sources",
            href: `${baseUrl}/sources`,
            icon: Library,
            isActive: (path: string) => path.startsWith(`${baseUrl}/sources`)
        },
        {
            label: "Master Record",
            href: `${baseUrl}/master`,
            icon: Database,
            isActive: (path: string) => path.startsWith(`${baseUrl}/master`)
        },
        {
            label: "Workbench",
            href: `${baseUrl}/workbench`,
            icon: Clipboard,
            isActive: (path: string) => path.startsWith(`${baseUrl}/workbench`)
        },
        {
            label: "Relationships",
            href: `${baseUrl}/relationships`,
            icon: Link2,
            isActive: (path: string) => path.startsWith(`${baseUrl}/relationships`) || path.startsWith(`${baseUrl}/engagement-new`) // Handle existing sub-routes if any
        },
        {
            label: "Access",
            href: `${baseUrl}/access`,
            icon: Users,
            isActive: (path: string) => path.startsWith(`${baseUrl}/access`)
        }
    ];

    return (
        <div className="border-b border-slate-200 bg-white sticky top-34 z-30"> {/* Sticky below header? Header is top-20 h-14 -> top-34? */}
            <div className="max-w-6xl mx-auto">
                <div className="relative group/nav">
                    {/* Fade Masks (Mobile Visual Cues) */}
                    <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none z-10 md:hidden" />
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 md:hidden" />

                    <nav
                        className="flex overflow-x-auto no-scrollbar py-0 px-4 md:px-8 space-x-6 md:space-x-8 mask-fade-sides"
                        aria-label="Tabs"
                    >
                        {tabs.map((tab) => {
                            const active = tab.isActive(pathname);
                            const Icon = tab.icon;
                            return (
                                <Link
                                    key={tab.label}
                                    href={tab.href}
                                    className={cn(
                                        "group inline-flex items-center gap-2 py-3 md:py-4 border-b-2 font-medium text-sm transition-all duration-200 ease-in-out whitespace-nowrap shrink-0",
                                        active
                                            ? "border-amber-500 text-blue-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                    )}
                                    aria-current={active ? "page" : undefined}
                                >
                                    <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500")} />
                                    <span>{tab.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </div>
    );
}
