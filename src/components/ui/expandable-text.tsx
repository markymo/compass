"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ExpandableTextProps {
    /** The raw text content. Paragraph breaks will be preserved. */
    text: string | null | undefined;
    /** Number of lines to show before clamping. Default: 4. Supported: 1-6 */
    maxLines?: number;
    /** Optional wrapper classes for layout constraints */
    className?: string;
    /** Optional classes for the text itself */
    textClassName?: string;
    /** Label for the expand button. Default: "Show more" */
    showMoreLabel?: string;
    /** Label for the collapse button. Default: "Show less" */
    showLessLabel?: string;
}

const CLAMP_CLASSES: Record<number, string> = {
    1: "line-clamp-1",
    2: "line-clamp-2",
    3: "line-clamp-3",
    4: "line-clamp-4",
    5: "line-clamp-5",
    6: "line-clamp-6",
};

export function ExpandableText({
    text,
    maxLines = 4,
    className,
    textClassName,
    showMoreLabel = "Show more",
    showLessLabel = "Show less"
}: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    // Fallback to 4 if outside supported range
    const safeMaxLines = CLAMP_CLASSES[maxLines] ? maxLines : 4;
    const clampClass = CLAMP_CLASSES[safeMaxLines];

    useEffect(() => {
        const el = textRef.current;
        if (!el) return;

        const checkOverflow = () => {
            if (!isExpanded) {
                // When clamped, if scrollHeight > clientHeight, it overflows
                setCanExpand(el.scrollHeight > el.clientHeight);
            }
        };

        checkOverflow();

        const ro = new ResizeObserver(checkOverflow);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text, isExpanded, safeMaxLines]);

    if (!text) {
        return null;
    }

    return (
        <div className={cn("flex flex-col items-start w-full", className)}>
            <div
                ref={textRef}
                className={cn(
                    "whitespace-pre-wrap w-full",
                    !isExpanded && clampClass,
                    textClassName
                )}
                style={{ wordBreak: "break-word" }}
            >
                {text}
            </div>
            {canExpand && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none focus:underline"
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? showLessLabel : showMoreLabel}
                </button>
            )}
        </div>
    );
}
