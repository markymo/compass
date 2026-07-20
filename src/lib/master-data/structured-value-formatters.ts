/**
 * structured-value-formatters.ts
 *
 * Pure string-formatting helpers for STRUCTURED_COLLECTION and GRAPH_RELATIONSHIP_COLLECTION field rows.
 * This module contains NO React or UI dependencies, making it safe for consumption by the
 * canonical field-interpreter and backend export pipelines.
 */

export interface StructuredValueFormatResult {
    handled: boolean;
    primary?: string;
    secondary?: string | null;
}

/**
 * Formats a date string as a short locale date (YYYY-MM-DD → "3 Mar 2006").
 * Returns null for null/undefined/unparseable input.
 */
export function formatDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw; // return raw if unparseable
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

export function formatNameHistoryRow(row: any): StructuredValueFormatResult {
    const primary = row.name ?? '(unnamed)';

    const from = formatDate(row.effectiveFrom);
    const to   = formatDate(row.effectiveTo);

    let secondary: string | null = null;
    if (from && to)   secondary = `${from} → ${to}`;
    else if (from)    secondary = `From ${from}`;
    else if (to)      secondary = `Until ${to}`;

    return { handled: true, primary, secondary };
}

export function formatPersonOrContactRow(row: any): StructuredValueFormatResult {
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

    return { handled: true, primary, secondary };
}

export function formatIndustryCodeRow(row: any): StructuredValueFormatResult {
    const code = row.code;
    const label = row.label;

    if (code && label) {
        return { handled: true, primary: `${code} — ${label}`, secondary: null };
    } else if (code) {
        return { handled: true, primary: String(code), secondary: null };
    } else if (label) {
        return { handled: true, primary: String(label), secondary: null };
    }

    return { handled: false };
}

const FIELD_ROW_FORMATTERS: Record<number, (row: any) => StructuredValueFormatResult> = {
    5: formatNameHistoryRow,
    20: formatIndustryCodeRow,
    63: formatPersonOrContactRow,
};

/**
 * Formats a collection row into a primary/secondary string representation.
 * If the field or row shape is unrecognized, returns { handled: false }.
 */
export function formatStructuredCollectionRow(fieldNo: number, row: any): StructuredValueFormatResult {
    let parsedRow = row;
    if (typeof row === 'string' && (row.startsWith('{') || row.startsWith('['))) {
        try {
            parsedRow = JSON.parse(row);
        } catch (e) {}
    }

    if (!parsedRow || typeof parsedRow !== 'object') {
        return { handled: false };
    }

    // Explicit formatters for known complex fields
    const formatter = FIELD_ROW_FORMATTERS[fieldNo];
    if (formatter) {
        return formatter(parsedRow);
    }

    return { handled: false };
}
