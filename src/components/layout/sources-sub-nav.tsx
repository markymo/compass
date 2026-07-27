"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Globe, Building2, Layers, Users, MapPin, FileText } from "lucide-react";

interface SourcesSubNavProps {
    leId: string;
    jurisdiction?: string | null;
    registryName?: string | null;
}

export function SourcesSubNav({ leId, jurisdiction, registryName }: SourcesSubNavProps) {
    const pathname = usePathname();
    const baseUrl = `/app/le/${leId}/sources`;

    // Determine Registry Label
    let registryLabel = registryName || "National Registry";
    if (!registryName) {
        if (jurisdiction === 'GB' || jurisdiction === 'UK') registryLabel = "Companies House";
        if (jurisdiction === 'FR') registryLabel = "Immatriculation (FR)";
    }

    const mainTabs = [
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
    ];

    const userSubItems = [
        {
            label: "Parties",
            href: `${baseUrl}/user-parties`,
            icon: Users,
            isActive: (path: string) => path.startsWith(`${baseUrl}/user-parties`) || path.startsWith(`${baseUrl}/user/parties`)
        },
        {
            label: "Addresses",
            href: `${baseUrl}/user-addresses`,
            icon: MapPin,
            isActive: (path: string) => path.startsWith(`${baseUrl}/user-addresses`) || path.startsWith(`${baseUrl}/user/addresses`)
        },
        {
            label: "Files",
            href: `${baseUrl}/user-files`,
            icon: FileText,
            isActive: (path: string) => path.startsWith(`${baseUrl}/user-files`) || path.startsWith(`${baseUrl}/user/files`)
        },
    ];

    return (
        <nav className="flex flex-col space-y-1 w-64 pr-8">
            {mainTabs.map((tab) => {
                const active = tab.isActive(pathname);
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.label}
                        href={tab.href}
                        className={cn(
                            "group flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-l-2",
                            active
                                ? "border-amber-500 text-blue-600 font-semibold"
                                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        )}
                    >
                        <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500")} />
                        {tab.label}
                    </Link>
                );
            })}

            {/* User Section with Indented Items */}
            <div className="pt-2">
                <div
                    className="flex items-center gap-3 px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    User
                </div>
                <div className="ml-3 pl-3 border-l border-slate-200 space-y-1 mt-1">
                    {userSubItems.map((subItem) => {
                        const active = subItem.isActive(pathname);
                        const Icon = subItem.icon;
                        return (
                            <Link
                                key={subItem.label}
                                href={subItem.href}
                                className={cn(
                                    "group flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors border-l-2 -ml-[13px]",
                                    active
                                        ? "border-amber-500 text-blue-600 font-semibold bg-amber-50/40 rounded-r"
                                        : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-r"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500")} />
                                {subItem.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
