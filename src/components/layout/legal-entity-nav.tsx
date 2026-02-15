"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Terminal,
    Database,
    Library,
    Building2,
    Users
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
            icon: Terminal,
            isActive: (path: string) => path.startsWith(`${baseUrl}/workbench`)
        },
        {
            label: "Relationships",
            href: `${baseUrl}/relationships`,
            icon: Building2,
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
        <div className="border-b border-slate-200 bg-white">
            <div className="max-w-6xl mx-auto px-8">
                <nav className="flex space-x-1" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const active = tab.isActive(pathname);
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.label}
                                href={tab.href}
                                className={cn(
                                    "group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ease-in-out",
                                    active
                                        ? "border-blue-600 text-blue-600"
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
    );
}
