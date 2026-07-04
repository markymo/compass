import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FieldSource } from "@/lib/master-data/field-display-model";
import { getSourceDisplayName } from "@/lib/source-display";
import { SOURCE_PALETTE } from "@/lib/master-data/source-palette";

export interface FieldSourceBadgeProps {
    source?: FieldSource | null;
    
    // Legacy fallback props
    legacySourceType?: string;
    legacySourceReference?: string;
    legacyRaId?: string;
    legacyRaName?: string;
    legacyTimestamp?: string;

    // Overrides
    className?: string;
    variant?: 'badge' | 'span';
    wrapperClassName?: string;
}

export function FieldSourceBadge({
    source,
    legacySourceType,
    legacySourceReference,
    legacyRaId,
    legacyRaName,
    legacyTimestamp,
    className,
    variant = 'badge',
    wrapperClassName
}: FieldSourceBadgeProps) {
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
        timestampStr = legacyTimestamp;

        if (legacySourceType === 'USER_INPUT') colorKey = 'USER';
        else if (legacySourceType === 'GLEIF') colorKey = 'GLEIF';
        else if (legacySourceType === 'REGISTRATION_AUTHORITY' || legacySourceType === 'NATIONAL_REGISTRY') colorKey = 'REGISTRY';
        else if (legacySourceType === 'AI_EXTRACTION') colorKey = 'AI';
        else if (legacySourceType === 'DEFAULT') colorKey = 'DEFAULT';
    }

    const palette = SOURCE_PALETTE[colorKey] || SOURCE_PALETTE['SYSTEM'];
    const paletteClasses = `${palette.bg} ${palette.text} ${palette.border}`;
    
    const content = (
        <>
            <span>{label}</span>
            {showRaCode && raId && (
                <span className="ml-1 opacity-60 font-mono normal-case tracking-normal">
                    &middot; {raId}
                </span>
            )}
            {timestampStr && (
                <span className="ml-1 opacity-50">
                    &middot; {new Date(timestampStr).toLocaleDateString()}
                </span>
            )}
        </>
    );

    let element;
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

    if (wrapperClassName) {
        return <div className={wrapperClassName}>{element}</div>;
    }

    return element;
}
