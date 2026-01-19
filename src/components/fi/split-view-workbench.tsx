"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SplitViewWorkbenchProps {
    leftPanel: ReactNode;
    rightPanel: ReactNode;
    className?: string;
}

export function SplitViewWorkbench({ leftPanel, rightPanel, className }: SplitViewWorkbenchProps) {
    return (
        <div className={cn("grid grid-cols-12 h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden", className)}>
            {/* Left Panel: Document Viewer */}
            <div className="col-span-6 border-r border-slate-200 bg-slate-100/50 flex flex-col h-full overflow-hidden">
                {leftPanel}
            </div>

            {/* Right Panel: Validation Grid */}
            <div className="col-span-6 bg-white flex flex-col h-full overflow-hidden shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                {rightPanel}
            </div>
        </div>
    );
}
