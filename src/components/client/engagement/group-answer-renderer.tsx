"use client";

/**
 * GroupAnswerRenderer
 *
 * Presentation-only component. Renders a questionnaire answer that is mapped
 * to a MasterFieldGroup as a vertical list of populated field rows.
 *
 * Rules:
 *  - Empty / unsynced fields are hidden by default (isSynced: false).
 *  - A subtle Eye toggle appears when hidden fields exist, allowing expand/collapse.
 *  - Source + Updated date shown per field row.
 *  - No DB calls. No client-side SIC lookup.
 *  - RA display names resolved from the pre-fetched raNameLookup prop.
 */

import { useState } from "react";
import { Database, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { RaNameLookup } from "@/lib/kyc/source-label";
import type { HydratedValue } from "@/actions/kyc-query";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { FieldSourceBadge } from "@/components/client/fields/FieldSourceBadge";
import { FieldAttachmentIndicator } from "@/components/shared/FieldAttachmentIndicator";
import { FieldAttachments } from "@/components/client/fields/FieldAttachments";

// ── Public API ────────────────────────────────────────────────────────────────

export interface GroupFieldData {
    fieldNo: number;
    /** Display label from MasterFieldDefinition.fieldName */
    fieldName: string;
    /** Prisma appDataType: 'TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'JSONB', etc. */
    appDataType: string;
    /** True for collection fields (SIC codes, directors, etc.) */
    isMultiValue: boolean;
    /**
     * If set, the field is a controlled-vocabulary code list.
     * Each item in value[] may be a string (old format) or { code, label } (new format).
     * e.g. 'SIC_2007_UK'
     */
    codeSystem?: string;
    /** Resolved value + provenance from resolveMasterData / resolveMasterDataBatch */
    hydrated: HydratedValue;
    /** Canonical display model for consistent rendering. Added in Phase 1 of migration. */
    canonicalDisplayModel?: import("@/lib/master-data/field-display-model").FieldDisplayModel;
}

export interface GroupAnswerRendererProps {
    /** Display label for the group, e.g. 'Nature of Business' */
    groupLabel: string;
    /** Per-field data in MasterFieldGroupItem.order */
    fields: GroupFieldData[];
    /**
     * Pre-fetched RA name map: { 'RA000585': 'Companies House', ... }
     * Serialisable Record<string,string> — safe across server/client boundary.
     */
    raNameLookup: RaNameLookup;
    /** Optional extra class on the outer wrapper */
    className?: string;
    /** The layout style to use for rendering the fields */
    displayStyle?: 'LIST' | 'COMPACT' | 'GRID';
}

function GroupFieldRow({
    field,
    raNameLookup,
    dimmed = false,
    displayStyle = 'LIST',
}: {
    field: GroupFieldData;
    raNameLookup: RaNameLookup;
    /** True for isSynced:false rows shown when the expand toggle is on */
    dimmed?: boolean;
    displayStyle?: 'LIST' | 'COMPACT' | 'GRID';
}) {
    const { fieldName } = field;

    const renderValue = () => {
        if (dimmed) {
            return <span className="text-xs text-slate-300 italic">—</span>;
        }
        if (field.canonicalDisplayModel) {
            // TODO: This limit (currently 10) might be made configurable one day.
            return <FieldValueRenderer field={field.canonicalDisplayModel} itemLimit={10} />;
        }
        return <span className="text-xs text-slate-300 italic">—</span>;
    };

    const isCompact = displayStyle === 'COMPACT';
    const isGrid = displayStyle === 'GRID';

    if (isGrid) {
        return (
            <div className={cn(
                "grid grid-cols-[40%_40%_20%] gap-x-2 items-center py-2 border-b border-slate-50 last:border-0 transition-opacity",
                dimmed && "opacity-40"
            )}>
                <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] truncate pr-2">
                    {fieldName}
                </div>
                <div className="text-slate-900 text-xs">
                    {renderValue()}
                </div>
                <div className="flex items-center justify-end pr-2">
                    {!dimmed && field.canonicalDisplayModel?.source && (
                        <div className="flex items-center gap-1">
                            {field.hydrated.attachmentCount ? (
                                <FieldAttachmentIndicator count={field.hydrated.attachmentCount} />
                            ) : null}
                            <FieldSourceBadge source={field.canonicalDisplayModel.source} variant="span" showLastValidated={true} className="text-[9px] py-0 px-1 whitespace-nowrap scale-90 origin-right" />
                        </div>
                    )}
                </div>
                {!dimmed && field.canonicalDisplayModel?.attachments && field.canonicalDisplayModel.attachments.length > 0 && (
                    <div className="col-span-3 mt-1 pb-1">
                        <FieldAttachments 
                            clientLEId="read-only"
                            fieldNo={field.fieldNo} 
                            attachments={field.canonicalDisplayModel.attachments} 
                            mode="read-only" 
                            isEditable={false} 
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cn(
            "transition-opacity",
            dimmed && "opacity-40",
            isCompact ? "py-1 border-0" : "py-3 border-b border-slate-50 last:border-0"
        )}>
            <div className="flex items-center gap-2 mb-1">
                <p className={cn(
                    "font-semibold text-slate-400 uppercase tracking-wider",
                    isCompact ? "text-[9px]" : "text-[10px]"
                )}>
                    {fieldName}
                </p>
                {isCompact && !dimmed && field.canonicalDisplayModel?.source && (
                    <div className="flex items-center gap-1.5">
                        <FieldSourceBadge source={field.canonicalDisplayModel.source} variant="span" showLastValidated={true} />
                        {field.hydrated.attachmentCount ? (
                            <FieldAttachmentIndicator count={field.hydrated.attachmentCount} />
                        ) : null}
                    </div>
                )}
            </div>
            <div className={cn(
                "text-slate-900",
                isCompact ? "text-xs" : "text-sm"
            )}>
                {renderValue()}
            </div>
            {!isCompact && !dimmed && field.canonicalDisplayModel?.source && (
                <div className="flex items-center gap-2 mt-1">
                    <FieldSourceBadge source={field.canonicalDisplayModel.source} variant="span" showLastValidated={true} />
                    {field.hydrated.attachmentCount ? (
                        <FieldAttachmentIndicator count={field.hydrated.attachmentCount} />
                    ) : null}
                </div>
            )}
            {!dimmed && field.canonicalDisplayModel?.attachments && field.canonicalDisplayModel.attachments.length > 0 && (
                <div className="mt-1">
                    <FieldAttachments 
                        clientLEId="read-only"
                        fieldNo={field.fieldNo} 
                        attachments={field.canonicalDisplayModel.attachments} 
                        mode="read-only" 
                        isEditable={false} 
                    />
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GroupAnswerRenderer({
    groupLabel,
    fields,
    raNameLookup,
    className,
    displayStyle = 'LIST',
}: GroupAnswerRendererProps) {
    const [showEmpty, setShowEmpty] = useState(false);

    // Filter: only show fields that have data
    const populated = fields.filter(f => f.hydrated.isSynced);
    const empty = fields.filter(f => !f.hydrated.isSynced);
    const hasHidden = empty.length > 0;

    const visibleFields = showEmpty ? fields : populated;

    if (populated.length === 0) {
        return (
            <div className={cn("flex items-center gap-2 text-xs text-slate-400 italic py-2", className)}>
                <Database className="h-3 w-3 shrink-0" />
                No master data recorded for this group.
            </div>
        );
    }

    return (
        <div className={cn("space-y-0", className)}>
            {groupLabel && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Database className="h-3 w-3" />
                    {groupLabel}
                </div>
            )}
            <div className={cn(
                "relative rounded-lg border border-slate-100 bg-white overflow-hidden p-3",
                displayStyle === 'COMPACT' ? "grid grid-cols-1 gap-y-3" : 
                displayStyle === 'GRID' ? "flex flex-col px-3 pb-1 pt-8" : "divide-y divide-slate-50"
            )}>
                {/* Expand/collapse empty-field toggle — only when hidden fields exist */}
                {hasHidden && (
                    <button
                        onClick={() => setShowEmpty(v => !v)}
                        title={showEmpty ? `Hide ${empty.length} empty field${empty.length !== 1 ? 's' : ''}` : `Show ${empty.length} empty field${empty.length !== 1 ? 's' : ''}`}
                        className={cn(
                            "absolute top-1.5 right-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors",
                            displayStyle === 'COMPACT' && "bg-white/90 shadow-sm border border-slate-100"
                        )}
                    >
                        {showEmpty
                            ? <EyeOff className="h-3 w-3" />
                            : <Eye className="h-3 w-3" />
                        }
                        <span>{empty.length}</span>
                    </button>
                )}
                {visibleFields.map(field => (
                    <GroupFieldRow
                        key={field.fieldNo}
                        field={field}
                        raNameLookup={raNameLookup}
                        dimmed={!field.hydrated.isSynced}
                        displayStyle={displayStyle}
                    />
                ))}
            </div>
        </div>
    );
}
