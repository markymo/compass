/**
 * structured-collection-renderers.tsx
 *
 * Lightweight rendering helpers for STRUCTURED_COLLECTION field rows.
 * Used in the field detail sheet, workbench, and any other read-only views.
 *
 * Design: pure functions — no hooks, no server calls.
 * Each renderer receives a raw valueJson row object and returns React nodes.
 *
 * Add a new renderer here when a new STRUCTURED_COLLECTION field is registered
 * in complex-field-config.ts. Map fieldNo → renderer in FIELD_ROW_RENDERERS.
 */

import React from 'react';
import { isPersonOrContactValue } from '@/lib/master-data/person-or-contact-value';

import { formatStructuredCollectionRow } from './structured-value-formatters';

export interface RowRenderResult {
    /** Primary display line (bold / prominent). */
    primary: string;
    /** Secondary line (muted, smaller). May be null if no date context. */
    secondary: string | null;
}

/**
 * Renders a collection row for the given fieldNo.
 * Falls back to a best-effort display of the raw value if no renderer is registered.
 */
export function renderCollectionRow(fieldNo: number, row: any): RowRenderResult {
    let parsedRow = row;
    if (typeof row === 'string' && (row.startsWith('{') || row.startsWith('['))) {
        try {
            parsedRow = JSON.parse(row);
        } catch (e) {}
    }

    if (isPersonOrContactValue(parsedRow)) {
        const res = formatStructuredCollectionRow(63, parsedRow);
        if (res.handled) {
            return { primary: res.primary || '', secondary: res.secondary || null };
        }
    }

    const res = formatStructuredCollectionRow(fieldNo, parsedRow);
    if (res.handled) {
        return { primary: res.primary || '', secondary: res.secondary || null };
    }

    // Generic fallback: try common name fields, then JSON
    if (parsedRow && typeof parsedRow === 'object') {
        const name = parsedRow.name ?? parsedRow.label ?? parsedRow.value ?? null;
        return {
            primary: name ? String(name) : JSON.stringify(parsedRow),
            secondary: null,
        };
    }
    return { primary: String(parsedRow ?? ''), secondary: null };
}

// ── React component ───────────────────────────────────────────────────────────

/**
 * Inline display of a single collection row.
 * Used in field detail sheets and workbench tables.
 */
export function CollectionRowDisplay({ fieldNo, row }: { fieldNo: number; row: any }) {
    const { primary, secondary } = renderCollectionRow(fieldNo, row);
    return (
        <span className="inline-flex flex-col leading-tight">
            <span className="font-medium text-slate-800 text-sm">{primary}</span>
            {secondary && (
                <span className="text-xs text-slate-400">{secondary}</span>
            )}
        </span>
    );
}
