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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RowRenderResult {
    /** Primary display line (bold / prominent). */
    primary: string;
    /** Secondary line (muted, smaller). May be null if no date context. */
    secondary: string | null;
}

// ── Field 5: Previous Names ───────────────────────────────────────────────────

export interface NameHistoryEntry {
    name?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    nameType?: string | null;
}

/**
 * Formats a date string as a short locale date (YYYY-MM-DD → "3 Mar 2006").
 * Returns null for null/undefined/unparseable input.
 */
function formatDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw; // return raw if unparseable
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

/**
 * Renders a single name-history row.
 *
 * Examples:
 *   name: "CENTRICA (LW) LIMITED", from: "2006-03-03", to: "2009-10-08"
 *     → primary:   "CENTRICA (LW) LIMITED"
 *     → secondary: "3 Mar 2006 → 8 Oct 2009"
 *
 *   name: "Some Old Name", no dates
 *     → primary:   "Some Old Name"
 *     → secondary: null
 */
export function renderNameHistoryRow(row: NameHistoryEntry): RowRenderResult {
    const primary = row.name ?? '(unnamed)';

    const from = formatDate(row.effectiveFrom);
    const to   = formatDate(row.effectiveTo);

    let secondary: string | null = null;
    if (from && to)   secondary = `${from} → ${to}`;
    else if (from)    secondary = `From ${from}`;
    else if (to)      secondary = `Until ${to}`;

    return { primary, secondary };
}

// ── Field 63: Company Directors ────────────────────────────────────────────────

export function renderPersonOrContactRow(row: any): RowRenderResult {
    const primary = [row.forenames || row.firstName, row.surname || row.lastName].filter(Boolean).join(' ') || 
        (row.contactType === 'PERSON' ? 'Person' : row.contactType === 'CONTACT' ? 'Contact' : 'Unknown');

    const rolesList = Array.isArray(row.roles) ? row.roles : [];
    const firstRole = rolesList[0];
    const roleLabel = firstRole?.roleTitle ?? firstRole?.roleType ?? null;

    const from = formatDate(firstRole?.appointedOn);
    const to = formatDate(firstRole?.resignedOn);

    let secondary: string | null = null;
    if (roleLabel) {
        secondary = roleLabel;
    }
    if (from || to) {
        const datesStr = from && to ? `${from} → ${to}` : from ? `Appointed ${from}` : `Resigned ${to}`;
        secondary = secondary ? `${secondary} (${datesStr})` : datesStr;
    }

    return { primary, secondary };
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Maps fieldNo → row renderer function.
 * When a field is not listed, the caller should fall back to JSON.stringify.
 */
export const FIELD_ROW_RENDERERS: Record<number, (row: any) => RowRenderResult> = {
    5: renderNameHistoryRow,
    63: renderPersonOrContactRow,
};

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
        return renderPersonOrContactRow(parsedRow);
    }

    const renderer = FIELD_ROW_RENDERERS[fieldNo];
    if (renderer) return renderer(parsedRow);

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
