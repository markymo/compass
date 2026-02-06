"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, Landmark, ArrowDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RelationshipCardProps {
    id: string;
    clientId: string;
    clientName: string;
    leName: string;
    supplierName: string;
    status: string;
    fiOrgId: string;
    clientLEId: string;
    userIsClient: boolean;
    userIsSupplier: boolean;
    className?: string;
}

export function RelationshipCard({
    id,
    clientId,
    clientName,
    leName,
    supplierName,
    status,
    fiOrgId,
    clientLEId,
    userIsClient,
    userIsSupplier,
    className,
}: RelationshipCardProps) {
    return (
        <Card className={cn(
            "hover:shadow-md transition-shadow border-indigo-100 relative h-full flex flex-col",
            className
        )}>
            <CardHeader className="pb-4">
                {/* Status Badge - Top Right */}
                <Badge
                    variant="outline"
                    className="absolute top-4 right-4 shrink-0"
                >
                    {status}
                </Badge>

                {/* Client Organization */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>{clientName}</span>
                </div>

                {/* Client LE - Indented */}
                <div className="flex items-center gap-2 pl-6 mb-3">
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                    <CardTitle className="text-lg text-emerald-700">
                        {leName}
                    </CardTitle>
                </div>

                {/* Arrow Separator */}
                <div className="flex justify-center mb-3">
                    <ArrowDown className="w-5 h-5 text-slate-300" />
                </div>

                {/* Supplier Organization */}
                <div className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-lg text-blue-700">
                        {supplierName}
                    </CardTitle>
                </div>
            </CardHeader>
            {/* Actions Footer */}
            <div className="mt-auto p-4 pt-0 flex gap-2">
                {userIsClient && (
                    <Link href={`/app/le/${clientLEId}/engagement-new/${id}`} className="flex-1">
                        <div className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 h-9 rounded-md flex items-center justify-center text-xs font-medium transition-colors border border-emerald-200">
                            Enter as Client
                        </div>
                    </Link>
                )}

                {userIsSupplier && (
                    <Link href={`/app/fi/${fiOrgId}/engagements/${id}`} className="flex-1">
                        <div className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 h-9 rounded-md flex items-center justify-center text-xs font-medium transition-colors border border-blue-200">
                            Enter as Supplier
                        </div>
                    </Link>
                )}
            </div>
        </Card>
    );
}
