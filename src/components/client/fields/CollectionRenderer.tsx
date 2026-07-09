import React from "react";
import { ArrowRight } from "lucide-react";
import { FieldDisplayModel, FieldSource, ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { FieldSourceBadge } from "./FieldSourceBadge";
import { FieldValueRenderer } from "./FieldValueRenderer";

export const COLLECTION_PREVIEW_LIMIT = 18;

export interface CollectionRendererProps {
    items: Array<{ value: ResolvedFieldValue; source?: FieldSource }>;
    fieldSource: FieldSource | null;
    collectionLayout?: "inline" | "block";
    itemLimit?: number;
    className?: string;
}

export function CollectionRenderer({
    items,
    fieldSource,
    collectionLayout = "inline",
    itemLimit = COLLECTION_PREVIEW_LIMIT,
    className
}: CollectionRendererProps) {
    if (!items || items.length === 0) {
        return null;
    }

    const visibleItems = items.slice(0, itemLimit);
    const hiddenCount = items.length - itemLimit;

    // Helper to render an individual item using the FieldValueRenderer
    const renderItem = (item: { value: ResolvedFieldValue; source?: FieldSource }, idx: number, layoutHint: "row" | "compact") => {
        const syntheticField: FieldDisplayModel = {
            state: 'POPULATED',
            value: item.value,
            source: item.source || null,
            fieldNo: -1,
            label: '',
            textSummary: '',
            isEditable: false,
            isMultiValue: false
        };

        return (
            <React.Fragment key={idx}>
                <FieldValueRenderer field={syntheticField} layout={layoutHint} />
                {/* Per-item sources are intentionally suppressed for this phase to preserve legacy 1:1 parity */}
            </React.Fragment>
        );
    };

    if (collectionLayout === "block") {
        return (
            <div className={`flex flex-col gap-2 w-full ${className || ''}`}>
                <div className="flex justify-between items-start w-full">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{items.length} Items</span>
                    {fieldSource && <FieldSourceBadge source={fieldSource} />}
                </div>
                <div className="flex flex-col w-full divide-y divide-slate-100 border border-slate-200 rounded-md bg-white shadow-sm overflow-hidden">
                    {visibleItems.map((item, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center min-h-[48px] min-w-0">
                            {renderItem(item, idx, "row")}
                        </div>
                    ))}
                </div>
                {hiddenCount > 0 && (
                    <div className="text-[11px] text-slate-500 font-medium mt-1 px-1 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                        + {hiddenCount} more — open drawer to review all <ArrowRight className="h-3 w-3" />
                    </div>
                )}
            </div>
        );
    }

    // List layout (formerly inline)
    return (
        <ul className={`list-disc pl-4 space-y-1 m-0 ${className || ''}`}>
            {visibleItems.map((item, idx) => (
                <li key={idx} className="marker:text-slate-800 text-slate-800">
                    {renderItem(item, idx, "compact")}
                </li>
            ))}
            {hiddenCount > 0 && (
                <li className="text-[11px] text-slate-500 font-medium italic list-none -ml-4 mt-1">
                    + {hiddenCount} more
                </li>
            )}
        </ul>
    );
}
