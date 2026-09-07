"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface RelationshipOverviewSectionProps {
    orgName: string;
    createdAt?: string | Date;
    hasSupplierAccess?: boolean;
    unansweredCount?: number;
    clientLEId?: string;
}

export function RelationshipOverviewSection({
    orgName,
    createdAt,
    hasSupplierAccess = false,
    unansweredCount = 24,
    clientLEId
}: RelationshipOverviewSectionProps) {
    // 1. Relationship Details (Real date if present, fallback to representative prototype date)
    const formattedCreatedDate = createdAt 
        ? new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : "11 Aug 2026";
    
    const supplierAccessText = hasSupplierAccess ? "Active" : "Not invited";

    // 2. Tasks route (Reuses existing /app/assignments destination)
    const tasksRoute = "/app/assignments";

    return (
        <div className="py-2 space-y-5 text-xs text-foreground">
            {/* --- Section 1: Relationship Details --- */}
            <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Relationship Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-1.5 gap-x-4">
                    <div className="text-muted-foreground font-medium">Created</div>
                    <div className="font-semibold text-foreground">{formattedCreatedDate}</div>

                    <div className="text-muted-foreground font-medium">Supplier access</div>
                    <div className="font-semibold text-foreground">{supplierAccessText}</div>
                </div>
            </div>

            {/* --- Section 2: Needs Attention --- */}
            <div className="pt-3 border-t border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Needs Attention</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-foreground">3 outstanding tasks</span>
                        <Link 
                            href={tasksRoute}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1"
                        >
                            View tasks <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-foreground">{unansweredCount} unanswered questions</span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-foreground">1 scheduled next step</span>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer hover:underline inline-flex items-center gap-1">
                            View <ArrowRight className="h-3 w-3" />
                        </span>
                    </div>
                </div>
            </div>

            {/* --- Section 3: Recent Activity --- */}
            <div className="pt-3 border-t border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-foreground">Answer released to <strong className="font-semibold text-foreground">{orgName}</strong></span>
                        <span className="text-muted-foreground font-mono text-[11px]">14 Aug</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-foreground">Questionnaire added</span>
                        <span className="text-muted-foreground font-mono text-[11px]">13 Aug</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-foreground">Relationship created</span>
                        <span className="text-muted-foreground font-mono text-[11px]">{formattedCreatedDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
