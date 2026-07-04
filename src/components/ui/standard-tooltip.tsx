import React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StandardTooltipProps {
    /** The content to display inside the tooltip popup */
    content: React.ReactNode;
    /** The element that triggers the tooltip. If omitted, a standard Info icon is used. */
    children?: React.ReactNode;
    /** Add a subtle dotted underline to the children to indicate hoverability */
    dottedUnderline?: boolean;
    /** Override the default info icon styling */
    iconClassName?: string;
    /** Override the default tooltip popup styling */
    contentClassName?: string;
}

export function StandardTooltip({ 
    content, 
    children,
    dottedUnderline = false,
    iconClassName = "h-3.5 w-3.5 text-slate-400 hover:text-slate-600 transition-colors",
    contentClassName = "text-xs max-w-xs text-center bg-emerald-600 text-white p-2 border-emerald-700 shadow-sm"
}: StandardTooltipProps) {
    
    // If no children provided, render the default Info icon
    const triggerContent = children ? (
        <span className={dottedUnderline ? "border-b border-dotted border-slate-400" : ""}>
            {children}
        </span>
    ) : (
        <Info className={iconClassName} />
    );

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1 cursor-default">
                        {triggerContent}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className={contentClassName}>
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
