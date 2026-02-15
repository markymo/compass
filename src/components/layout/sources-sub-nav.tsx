"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Globe, BookOpen, Lock, Archive, Building2 } from "lucide-react";

interface SourcesSubNavProps {
    leId: string;
    jurisdiction?: string | null;
}

export function SourcesSubNav({ leId, jurisdiction }: SourcesSubNavProps) {
    const pathname = usePathname();
    const baseUrl = `/app/le/${leId}/sources`;

    // Determine Registry Label
    let registryLabel = "National Registry";
    if (jurisdiction === 'GB') registryLabel = "Companies House";
    if (jurisdiction === 'FR') registryLabel = "Immatriculation (FR)";

    const tabs = [
        {
            label: "GLEIF",
            href: `${baseUrl}/gleif`,
            icon: Globe,
            isActive: (path: string) => path.startsWith(`${baseUrl}/gleif`)
        },
        {
            label: registryLabel,
            href: `${baseUrl}/registry`,
            icon: Building2,
            isActive: (path: string) => path.startsWith(`${baseUrl}/registry`)
        },
        {
            label: "Knowledge Base",
            href: `${baseUrl}/knowledge`,
            icon: BookOpen,
            isActive: (path: string) => path.startsWith(`${baseUrl}/knowledge`)
        },
        {
            label: "Digital Vault",
            href: `${baseUrl}/vault`,
            icon: Lock,
            isActive: (path: string) => path.startsWith(`${baseUrl}/vault`)
        }
    ];

    return (
        <nav className="flex flex-col space-y-1 w-64 pr-8">
            {tabs.map((tab) => {
                const active = tab.isActive(pathname);
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.label}
                        href={tab.href}
                        className={cn(
                            "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                            active
                                ? "bg-slate-100 text-slate-900"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        <Icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500")} />
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
