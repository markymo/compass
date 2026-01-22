"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";

interface AccessDebugInfoProps {
    className?: string;
    data: {
        userId: string;
        email?: string;
        roleLabel: string;
        permissions: Record<string, boolean>;
        contextId?: string;
        contextName?: string;
    };
}

export function AccessDebugInfo({ data, className = "" }: AccessDebugInfoProps) {
    const [expanded, setExpanded] = useState(false);

    // Only show in development or if explicitly enabled? 
    // User requested "somewhere subtle", so we'll show it but collapsed by default maybe?
    // Or just small text.

    return (
        <div className={`border-t border-slate-200 py-4 mt-12 ${className}`}>
            <div
                className="flex items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity justify-center"
                onClick={() => setExpanded(!expanded)}
            >
                <ShieldAlert className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                    Access Context: {data.roleLabel}
                </span>
                {expanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
            </div>

            {expanded && (
                <div className="mt-4 p-4 bg-slate-100 rounded-md max-w-2xl mx-auto text-xs font-mono text-slate-600 overflow-x-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-bold mb-1">User Identity</p>
                            <p>ID: {data.userId}</p>
                            <p>Email: {data.email || "N/A"}</p>
                        </div>
                        <div>
                            <p className="font-bold mb-1">Target Context</p>
                            <p>Name: {data.contextName}</p>
                            <p>ID: {data.contextId}</p>
                        </div>
                        <div className="col-span-2 border-t border-slate-200 pt-2 mt-2">
                            <p className="font-bold mb-1">Effective Permissions</p>
                            <pre>{JSON.stringify(data.permissions, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
