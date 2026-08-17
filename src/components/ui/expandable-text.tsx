"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ExpandableTextProps {
    /** The raw text content. Paragraph breaks will be preserved. */
    text: string | null | undefined;
    /** Target character count when truncated. Default: 300 */
    targetChars?: number;
    /** Minimum total character count required before triggering truncation. Default: 400 */
    overflowThreshold?: number;
    /** Optional wrapper classes for layout constraints */
    className?: string;
    /** Optional classes for the text itself */
    textClassName?: string;
    /** Label for the expand button. Default: "Show more" */
    showMoreLabel?: string;
    /** Label for the collapse button. Default: "Show less" */
    showLessLabel?: string;
}

export function truncateToNearestWord(str: string, targetChars: number = 300): string {
    if (!str || str.length <= targetChars) return str;
    const sliced = str.slice(0, targetChars);
    const lastSpace = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf('\n'));
    if (lastSpace > Math.floor(targetChars * 0.7)) {
        return sliced.slice(0, lastSpace).trimEnd();
    }
    return sliced.trimEnd();
}

export function ExpandableText({
    text,
    targetChars = 300,
    overflowThreshold = 400,
    className,
    textClassName,
    showMoreLabel = "Show more",
    showLessLabel = "Show less"
}: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!text || text.trim() === '') {
        return null;
    }

    // Only trigger truncation if text exceeds overflowThreshold (default 400 chars).
    // If text is between 300 and 400 chars, render it in full so "Show more" is never shown for just a few characters.
    const needsTruncation = text.length > overflowThreshold;

    if (!needsTruncation) {
        return (
            <div className={cn("w-full text-left", className)}>
                <span className={cn("whitespace-pre-wrap break-words", textClassName)}>
                    {text}
                </span>
            </div>
        );
    }

    const truncated = truncateToNearestWord(text, targetChars);

    return (
        <div className={cn("w-full text-left", className)}>
            <span className={cn("whitespace-pre-wrap break-words", textClassName)}>
                {!isExpanded ? (
                    <>
                        {truncated}…{" "}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsExpanded(true);
                            }}
                            className="inline font-medium text-slate-500 hover:text-slate-800 hover:underline bg-transparent border-0 p-0 m-0 cursor-pointer text-inherit leading-inherit align-baseline"
                            aria-expanded={false}
                        >
                            {showMoreLabel}
                        </button>
                    </>
                ) : (
                    <>
                        {text}{" "}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsExpanded(false);
                            }}
                            className="inline ml-1 font-medium text-slate-500 hover:text-slate-800 hover:underline bg-transparent border-0 p-0 m-0 cursor-pointer text-inherit leading-inherit align-baseline"
                            aria-expanded={true}
                        >
                            {showLessLabel}
                        </button>
                    </>
                )}
            </span>
        </div>
    );
}
