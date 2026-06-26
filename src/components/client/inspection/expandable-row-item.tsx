import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableRowItemProps {
    isExpanded: boolean;
    onToggle: () => void;
    collapsedContent: React.ReactNode;
    expandedContent: React.ReactNode;
    actions?: React.ReactNode;
    badges?: React.ReactNode;
}

export function ExpandableRowItem({
    isExpanded,
    onToggle,
    collapsedContent,
    expandedContent,
    actions,
    badges
}: ExpandableRowItemProps) {
    return (
        <div className="w-full">
            {/* Clickable Header Row */}
            <div 
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                    isExpanded 
                        ? "bg-slate-50 border-slate-200" 
                        : "bg-white border-slate-150 hover:border-slate-300 hover:shadow-sm group"
                }`}
            >
                {/* Left side: chevron + content */}
                <div className="flex flex-1 items-start gap-2 min-w-0">
                    <div className="pt-0.5 text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                        {collapsedContent}
                    </div>
                </div>

                {/* Right side: badges + actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        {badges}
                    </div>
                    <div 
                        // Stop propagation so clicking actions doesn't toggle the row
                        onClick={(e) => e.stopPropagation()} 
                        onKeyDown={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1 ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100"}`}
                    >
                        {actions}
                    </div>
                </div>
            </div>

            {/* Expanded Detail Body */}
            {isExpanded && (
                <div className="mt-2 pl-9 pr-3 pb-2 animate-in slide-in-from-top-1 fade-in duration-200">
                    {expandedContent}
                </div>
            )}
        </div>
    );
}
