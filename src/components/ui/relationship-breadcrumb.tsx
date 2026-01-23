"use client";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Building2, Landmark } from "lucide-react";
import Link from "next/link";

interface PathItem {
    label: string;
    href?: string;
}

interface RelationshipBreadcrumbProps {
    clientPath: PathItem[];
    supplierPath: PathItem[];
    title: string; // The central title (Relationship Name)
    className?: string;
}

export function RelationshipBreadcrumb({
    clientPath,
    supplierPath,
    title,
    className,
}: RelationshipBreadcrumbProps) {
    return (
        <div className={cn("w-full mb-6", className)}>
            <div className="flex flex-col md:flex-row justify-between items-end border-b pb-4 gap-4">
                {/* LEFT: Client Context */}
                <div className="flex flex-col gap-1 items-start max-w-[40%]">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                        <Building2 className="w-3.5 h-3.5" />
                        Client Context
                    </div>
                    <Breadcrumb>
                        <BreadcrumbList>
                            {clientPath.map((item, index) => (
                                <div key={index} className="flex items-center">
                                    <BreadcrumbItem>
                                        {item.href ? (
                                            <BreadcrumbLink asChild>
                                                <Link href={item.href}>{item.label}</Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                    {/* Don't show separator after the last item */}
                                    {index < clientPath.length - 1 && (
                                        <BreadcrumbSeparator className="ml-1 mr-1" />
                                    )}
                                </div>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                {/* CENTER: Title */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900 leading-none">{title}</h1>
                </div>

                {/* RIGHT: Supplier Context */}
                <div className="flex flex-col gap-1 items-end max-w-[40%]">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                        Supplier Context
                        <Landmark className="w-3.5 h-3.5" />
                    </div>
                    <Breadcrumb>
                        <BreadcrumbList className="justify-end bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {supplierPath.map((item, index) => (
                                <div key={index} className="flex items-center">
                                    <BreadcrumbItem>
                                        {item.href ? (
                                            <BreadcrumbLink asChild>
                                                <Link href={item.href} className="text-indigo-600 hover:text-indigo-800">{item.label}</Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage className="text-indigo-900 font-medium">{item.label}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                    {/* Don't show separator after the last item */}
                                    {index < supplierPath.length - 1 && (
                                        <BreadcrumbSeparator className="ml-1 mr-1 text-slate-300" />
                                    )}
                                </div>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </div>
        </div>
    );
}
