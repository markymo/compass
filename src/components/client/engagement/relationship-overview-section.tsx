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
        <div className="py-2 space-y-5 text-xs text-slate-700">
            {/* --- Section 1: Relationship Details --- */}
            <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Relationship Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-1.5 gap-x-4">
                    <div className="text-slate-500 font-medium">Created</div>
                    <div className="font-semibold text-slate-800">{formattedCreatedDate}</div>

                    <div className="text-slate-500 font-medium">Supplier access</div>
                    <div className="font-semibold text-slate-800">{supplierAccessText}</div>
                </div>
            </div>

            {/* --- Section 2: Needs Attention --- */}
            <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Needs Attention</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">3 outstanding tasks</span>
                        <Link 
                            href={tasksRoute}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
                        >
                            View tasks <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">{unansweredCount} unanswered questions</span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">1 scheduled next step</span>
                        <span className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer hover:underline inline-flex items-center gap-1">
                            View <ArrowRight className="h-3 w-3" />
                        </span>
                    </div>
                </div>
            </div>

            {/* --- Section 3: Recent Activity --- */}
            <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Activity</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-slate-700">Answer released to <strong className="font-semibold text-slate-800">{orgName}</strong></span>
                        <span className="text-slate-400 font-mono text-[11px]">14 Aug</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-slate-700">Questionnaire added</span>
                        <span className="text-slate-400 font-mono text-[11px]">13 Aug</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                        <span className="text-slate-700">Relationship created</span>
                        <span className="text-slate-400 font-mono text-[11px]">{formattedCreatedDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
