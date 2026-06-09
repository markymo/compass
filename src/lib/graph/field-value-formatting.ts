/**
 * field-value-formatting.ts
 *
 * Neutral (no "use server" / "use client") shared utilities for formatting
 * and searching graph node field values.
 *
 * Imported by:
 *   src/actions/graph-node-picker.ts  (server-side display label building)
 *   src/components/client/graph/graph-node-picker.tsx  (client search)
 *   src/components/client/graph/graph-node-picker-dialog.tsx  (client search)
 *
 * ## Why a shared file?
 * formatRawFieldValue was originally defined inside graph-node-picker.ts ("use server").
 * Importing a server-action function into a client component violates Next.js bundling rules.
 * Moving the pure logic here keeps it neutral and importable from both contexts.
 */

import { getNodeField, type NodeType, type NodeFieldDataType } from "./node-field-registry";
import { sanitizePickerConfig, type GraphPickerConfig } from "./picker-config";

// ── Value formatting ───────────────────────────────────────────────────────────

/**
 * Format a single rawField value for display/search, based on its NODE_FIELD_REGISTRY dataType.
 *
 * Rules:
 *   null / undefined / empty string → null (omit)
 *   TEXT / COUNTRY_CODE  → string (trimmed); objects/arrays → null
 *   DATE (Date or ISO string) → "YYYY-MM-DD" (locale-independent)
 *   BOOLEAN              → "Yes" / "No"
 *   NUMBER               → String(value)
 *   unsupported object   → null (omit)
 *
 * Returns null to signal "omit from display/search".
 */
export function formatRawFieldValue(value: unknown, dataType: NodeFieldDataType): string | null {
    if (value === null || value === undefined) return null;

    switch (dataType) {
        case "TEXT":
        case "COUNTRY_CODE": {
            // Reject objects and arrays — only stringify primitives
            if (typeof value === "object") return null;
            const str = typeof value === "string" ? value.trim() : String(value).trim();
            return str.length > 0 ? str : null;
        }

        case "DATE": {
            if (value instanceof Date) {
                if (isNaN(value.getTime())) return null;
                return value.toISOString().slice(0, 10); // YYYY-MM-DD
            }
            if (typeof value === "string") {
                const d = new Date(value);
                if (isNaN(d.getTime())) return null;
                return d.toISOString().slice(0, 10);
            }
            return null;
        }

        case "BOOLEAN": {
            if (typeof value === "boolean") return value ? "Yes" : "No";
            if (value === "true")  return "Yes";
            if (value === "false") return "No";
            return null;
        }

        case "NUMBER": {
            if (typeof value === "number" && !isNaN(value)) return String(value);
            if (typeof value === "string" && value.trim().length > 0) return value.trim();
            return null;
        }

        default:
            if (typeof value === "object") return null;
            return null;
    }
}

// ── Search ─────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a picker item required for search.
 * Structurally matches GraphNodePickerItem without creating a circular import.
 */
export interface PickerItemSearchable {
    displayLabel: string;
    subLabel: string | null;
    activeEdgeTypes: string[];
    rawFields: Record<string, unknown>;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
}

/**
 * itemMatchesSearch
 *
 * Returns true if a picker item matches the given query string.
 *
 * Search corpus (always included — legacy behaviour preserved):
 *   - item.displayLabel
 *   - item.subLabel
 *   - item.activeEdgeTypes (each)
 *
 * Additional search corpus when pickerConfig.searchFields is set:
 *   - item.rawFields[fieldKey] for each fieldKey in sanitized searchFields
 *   - Values formatted via formatRawFieldValue() for type-appropriate comparison
 *   - Null/empty formatted values are skipped (not searched)
 *
 * Validation:
 *   - pickerConfig is sanitized via sanitizePickerConfig() before use.
 *   - Unknown fieldKeys (not in NODE_FIELD_REGISTRY) are silently ignored.
 *   - Invalid/non-object pickerConfig → treated as null (legacy search only).
 *
 * @param item   - The picker item to test.
 * @param query  - Search query, already lowercased by the caller.
 * @param pickerConfig - Optional config from MasterFieldGraphBinding.pickerConfig.
 */
export function itemMatchesSearch(
    item: PickerItemSearchable,
    query: string,
    pickerConfig?: GraphPickerConfig | Record<string, unknown> | null
): boolean {
    if (!query) return true;

    // 1. Legacy sources — always searched
    const legacySources: string[] = [
        item.displayLabel.toLowerCase(),
        ...(item.subLabel ? [item.subLabel.toLowerCase()] : []),
        ...item.activeEdgeTypes.map(et => et.toLowerCase()),
    ];

    if (legacySources.some(s => s.includes(query))) return true;

    // 2. Configured rawFields search
    // Sanitize the pickerConfig defensively client-side (may be raw DB JSON).
    const validatedConfig = sanitizePickerConfig(
        item.nodeType as NodeType,
        pickerConfig ?? null
    );

    if (!validatedConfig?.searchFields?.length) return false;

    for (const fieldKey of validatedConfig.searchFields) {
        const fieldDef = getNodeField(item.nodeType as NodeType, fieldKey);
        if (!fieldDef) continue; // unknown key — skip

        const rawValue = item.rawFields[fieldKey];
        const formatted = formatRawFieldValue(rawValue, fieldDef.dataType);
        if (formatted !== null && formatted.toLowerCase().includes(query)) return true;
    }

    return false;
}
