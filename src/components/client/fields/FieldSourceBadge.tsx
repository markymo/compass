"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FieldSource } from "@/lib/master-data/field-display-model";
import { getSourceDisplayName } from "@/lib/source-display";
import { SOURCE_PALETTE } from "@/lib/master-data/source-palette";
import { StandardTooltip } from "@/components/ui/standard-tooltip";
import { useSession } from "next-auth/react";
import { formatSystemDateTime } from "@/lib/date-utils";
import { getRegistryEntityUrl } from "@/lib/registry-urls";

export interface FieldSourceBadgeProps {
    source?: FieldSource | null;
    
    // Direct or resolved external link props
    entityUrl?: string | null;
    entityIdentifier?: string | null;

    // Legacy fallback props
    legacySourceType?: string;
    legacySourceReference?: string;
    legacyRaId?: string;
    legacyRaName?: string;
    legacyTimestamp?: string | Date | null;

    // Optional feature flags
    showLastValidated?: boolean;

    // Overrides
    className?: string;
    variant?: 'badge' | 'span';
    wrapperClassName?: string;
}

export function FieldSourceBadge({
    source,
    entityUrl,
    entityIdentifier,
    legacySourceType,
    legacySourceReference,
    legacyRaId,
    legacyRaName,
    legacyTimestamp,
    showLastValidated = false,
    className,
    variant = 'badge',
    wrapperClassName
}: FieldSourceBadgeProps) {
    const { data: session } = useSession();
    if (!source && !legacySourceType) {
        return null;
    }

    let label = '';
    let colorKey = 'SYSTEM';
    let raId: string | undefined = undefined;
    let timestampStr: string | undefined = undefined;
    let showRaCode = false;

    if (source) {
        label = source.label;
        colorKey = source.colorKey;
        timestampStr = source.timestamp;
        showRaCode = source.type === 'REGISTRATION_AUTHORITY' && !!source.reference;
        if (showRaCode) {
            raId = source.reference ?? undefined;
        }
    } else if (legacySourceType) {
        // Resolve legacy dynamically
        showRaCode = legacySourceType === 'REGISTRATION_AUTHORITY' && !!legacyRaId;
        
        if (showRaCode && legacyRaName) {
            label = legacyRaName;
        } else {
            label = getSourceDisplayName(legacySourceType, legacySourceReference ?? null);
        }
        
        raId = legacyRaId;
        timestampStr = legacyTimestamp ? (legacyTimestamp instanceof Date ? legacyTimestamp.toISOString() : legacyTimestamp) : undefined;

        if (legacySourceType === 'USER_INPUT') colorKey = 'USER';
        else if (legacySourceType === 'GLEIF') colorKey = 'GLEIF';
        else if (legacySourceType === 'REGISTRATION_AUTHORITY' || legacySourceType === 'NATIONAL_REGISTRY') colorKey = 'REGISTRY';
        else if (legacySourceType === 'AI_EXTRACTION') colorKey = 'AI';
        else if (legacySourceType === 'DEFAULT') colorKey = 'DEFAULT';
    }

    const resolvedUrl = getRegistryEntityUrl({
        sourceType: source?.type || legacySourceType,
        sourceReference: source?.reference || legacySourceReference || legacyRaId,
        entityIdentifier: entityIdentifier || source?.entityIdentifier,
        entityUrl: entityUrl || source?.entityUrl,
    });

    const palette = SOURCE_PALETTE[colorKey] || SOURCE_PALETTE['SYSTEM'];
    const paletteClasses = `${palette.bg} ${palette.text} ${palette.border}`;
    
    const content = (
        <>
            <span>{label}</span>
        </>
    );

    let element;
    if (resolvedUrl) {
        const linkClass = "hover:opacity-80 transition-opacity cursor-pointer inline-flex items-center";
        if (variant === 'badge') {
            element = (
                <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                    title={`View ${label} external record`}
                    data-testid="source-badge-link"
                >
                    <Badge variant="outline" className={cn("text-[10px] h-auto py-0.5 hover:underline", paletteClasses, className)}>
                        {content}
                    </Badge>
                </a>
            );
        } else {
            element = (
                <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                    title={`View ${label} external record`}
                    data-testid="source-badge-link"
                >
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border hover:underline", paletteClasses, className)}>
                        {content}
                    </span>
                </a>
            );
        }
    } else {
        if (variant === 'badge') {
            element = (
                <Badge variant="outline" className={cn("text-[10px] h-auto py-0.5", paletteClasses, className)}>
                    {content}
                </Badge>
            );
        } else {
            element = (
                <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", paletteClasses, className)}>
                    {content}
                </span>
            );
        }
    }

    if (wrapperClassName) {
        element = <div className={wrapperClassName}>{element}</div>;
    }

    if (showLastValidated && source?.lastValidatedAt) {
        return (
            <div className="flex items-center gap-2">
                {element}
                <div className="flex flex-col text-[10px] text-slate-400 border-l border-slate-200 pl-2 leading-tight justify-center">
                    <StandardTooltip content="Based on the latest validation recorded for this value.">
                        <span className="whitespace-nowrap">
                            Last validated: {formatSystemDateTime(source.lastValidatedAt, (session?.user as any)?.timezone || 'UTC')}
                        </span>
                    </StandardTooltip>
                </div>
            </div>
        );
    }

    return element;
}
