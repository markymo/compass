"use server";

import prisma from "@/lib/prisma";
import { getNodeFields, getNodeField, type NodeType, type NodeFieldDataType } from "@/lib/graph/node-field-registry";
import { sanitizePickerConfig, type GraphPickerConfig } from "@/lib/graph/picker-config";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GraphNodePickerItem {
    nodeId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    personId: string | null;
    legalEntityId: string | null;
    addressId: string | null;
    displayLabel: string;
    subLabel: string | null;
    source: string;
    /** edgeTypes this node has in the LE graph (for role badges) */
    activeEdgeTypes: string[];
    /** Whether this node has an active edge matching filterEdgeType */
    isPromoted: boolean;
    /**
     * Structured field values keyed by fieldKey from NODE_FIELD_REGISTRY.
     *
     * Phase 1 infrastructure — populated from registry storagePaths.
     * Phase 3: consumed by buildConfiguredDisplay() when pickerConfig is present.
     *
     * Example:
     *   { firstName: "Alan", lastName: "Bennett", primaryNationality: "British",
     *     dateOfBirth: Date("1952-04-30"), placeOfBirth: null, ... }
     */
    rawFields: Record<string, unknown>;
}

interface GetGraphNodesForPickerInput {
    clientLEId: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
    /**
     * Optional per-binding picker display config (from MasterFieldGraphBinding.pickerConfig).
     * When present and valid: drives displayLabel / subLabel from rawFields + registry.
     * When null / absent / invalid: legacy hardcoded display used unchanged.
     * Server-side validated with sanitizePickerConfig() before use.
     */
    pickerConfig?: GraphPickerConfig | Record<string, unknown> | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Build a Prisma select object for an entity (person / legalEntity / address)
 * from NODE_FIELD_REGISTRY. Always includes `id` plus every column referenced
 * by a SYSTEM_COLUMN storagePath for the given nodeType.
 */
function buildEntitySelect(nodeType: NodeType): Record<string, boolean> {
    const select: Record<string, boolean> = { id: true };
    for (const field of getNodeFields(nodeType)) {
        const parts = field.storagePath.split(".");
        if (parts.length === 2) {
            select[parts[1]] = true; // e.g. "person.firstName" → "firstName"
        }
    }
    return select;
}

/**
 * Resolve all registry fields for a node into a flat Record<fieldKey, value>.
 * Missing/null fields resolve to null (never undefined).
 */
function buildRawFields(node: any, nodeType: NodeType): Record<string, unknown> {
    const rawFields: Record<string, unknown> = {};
    for (const field of getNodeFields(nodeType)) {
        const parts = field.storagePath.split(".");
        if (parts.length === 2) {
            const [entityKey, columnKey] = parts;
            rawFields[field.fieldKey] = node[entityKey]?.[columnKey] ?? null;
        }
    }
    return rawFields;
}

/**
 * Format a single rawField value for display, based on its NODE_FIELD_REGISTRY dataType.
 *
 * Rules:
 *   null / undefined / empty string → null (omit from display)
 *   TEXT / COUNTRY_CODE             → string as-is
 *   DATE (Date object or ISO string)→ YYYY-MM-DD
 *   BOOLEAN                         → "Yes" / "No"
 *   NUMBER                          → String(value)
 *   unsupported object              → null (omit)
 *
 * Intentionally locale-independent for stable, testable output.
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
            // Reject objects, arrays, etc.
            if (typeof value === "object") return null;
            return null;
    }
}

/** Separator used between configured field values in subLabel / displayLabel. */
const FIELD_SEPARATOR = " · ";

/**
 * Join a list of fieldKeys from rawFields into a display string, omitting
 * fields that are null/empty after dataType-aware formatting.
 */
function joinConfiguredFields(
    fieldKeys: string[],
    rawFields: Record<string, unknown>,
    nodeType: NodeType
): string {
    const parts: string[] = [];
    for (const key of fieldKeys) {
        const fieldDef = getNodeField(nodeType, key);
        if (!fieldDef) continue;
        const formatted = formatRawFieldValue(rawFields[key], fieldDef.dataType);
        if (formatted !== null) parts.push(formatted);
    }
    return parts.join(FIELD_SEPARATOR);
}

/**
 * Build display label/subLabel using pickerConfig fieldKeys from rawFields.
 * Returns null for each slot if the resulting string is empty (caller falls back to legacy).
 */
function buildConfiguredDisplay(
    rawFields: Record<string, unknown>,
    nodeType: NodeType,
    config: GraphPickerConfig
): { displayLabel: string | null; subLabel: string | null } {
    const displayLabel =
        config.displayFields && config.displayFields.length > 0
            ? joinConfiguredFields(config.displayFields, rawFields, nodeType) || null
            : null;

    const subLabel =
        config.subFields && config.subFields.length > 0
            ? joinConfiguredFields(config.subFields, rawFields, nodeType) || null
            : null;

    return { displayLabel, subLabel };
}

/**
 * Build legacy hardcoded display labels (pre-Phase-3 behaviour).
 * Used when pickerConfig is null, or when configured display resolves to empty.
 */
function buildLegacyDisplay(
    node: any
): { displayLabel: string; subLabel: string | null } {
    let displayLabel = "Unknown";
    let subLabel: string | null = null;

    if (node.nodeType === "PERSON" && node.person) {
        displayLabel = [node.person.firstName, node.person.middleName, node.person.lastName]
            .filter(Boolean)
            .join(" ") || "Unknown Person";
        subLabel = node.person.primaryNationality ?? null;
    } else if (node.nodeType === "LEGAL_ENTITY" && node.legalEntity) {
        displayLabel = node.legalEntity.name || node.legalEntity.localRegistrationNumber || "Unknown Entity";
        subLabel = node.legalEntity.localRegistrationNumber ?? null;
    } else if (node.nodeType === "ADDRESS" && node.address) {
        displayLabel = [node.address.line1, node.address.city, node.address.postalCode, node.address.country]
            .filter(Boolean)
            .join(", ") || "Unknown Address";
        subLabel = node.address.country ?? null;
    }

    return { displayLabel, subLabel };
}

// ── Server action ──────────────────────────────────────────────────────────────

/**
 * getGraphNodesForPicker
 *
 * Fetches all graph nodes for a given LE scoped to a node type.
 * Returns items sorted alphabetically ascending by displayLabel.
 *
 * Phase 1: each item carries rawFields (registry-driven structured field values).
 * Phase 3: when pickerConfig is supplied and valid, displayLabel / subLabel are built
 *          from pickerConfig.displayFields / pickerConfig.subFields via rawFields.
 *          Falls back to legacy hardcoded display if config is null, invalid, or produces
 *          an empty string.
 */
export async function getGraphNodesForPicker(
    input: GetGraphNodesForPickerInput
): Promise<{ success: true; items: GraphNodePickerItem[] } | { success: false; error: string }> {
    try {
        const { clientLEId, graphNodeType, filterEdgeType, filterActiveOnly = true } = input;

        // Validate and sanitize pickerConfig server-side.
        // Accepts raw DB JSON or a typed object. Invalid/unknown keys stripped.
        const validatedConfig = sanitizePickerConfig(
            graphNodeType as NodeType,
            input.pickerConfig ?? null
        );

        // 1. Fetch all nodes of the requested type for this LE.
        //    Entity selects are derived from NODE_FIELD_REGISTRY so that widening
        //    the registry automatically widens the fetch without a separate code change.
        const nodes = await (prisma as any).clientLEGraphNode.findMany({
            where: {
                clientLEId,
                nodeType: graphNodeType,
            },
            include: {
                person: {
                    select: buildEntitySelect("PERSON"),
                },
                legalEntity: {
                    select: buildEntitySelect("LEGAL_ENTITY"),
                },
                address: {
                    select: buildEntitySelect("ADDRESS"),
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // 2. Fetch active edges for this LE (to know which nodes have which roles)
        const edges = await (prisma as any).clientLEGraphEdge.findMany({
            where: {
                clientLEId,
                ...(filterActiveOnly ? { isActive: true } : {}),
            },
            select: {
                fromNodeId: true,
                edgeType: true,
                isActive: true,
            },
        });

        // 3. Build nodeId → activeEdgeTypes map
        const edgeMap = new Map<string, string[]>();
        for (const e of edges) {
            if (!edgeMap.has(e.fromNodeId)) edgeMap.set(e.fromNodeId, []);
            if (!edgeMap.get(e.fromNodeId)!.includes(e.edgeType)) {
                edgeMap.get(e.fromNodeId)!.push(e.edgeType);
            }
        }

        // 4. Build picker items
        const items: GraphNodePickerItem[] = nodes.map((node: any) => {
            const activeEdgeTypes = edgeMap.get(node.id) ?? [];

            // Promotion sort is intentionally disabled.
            const isPromoted = false;

            // Build rawFields from registry (Phase 1 infrastructure)
            const rawFields = buildRawFields(node, node.nodeType as NodeType);

            // ── displayLabel / subLabel ────────────────────────────────────────
            // Phase 3: if a valid pickerConfig is present, use configured display.
            // Fall back to legacy if config is null OR configured output is empty.
            const legacy = buildLegacyDisplay(node);

            let displayLabel = legacy.displayLabel;
            let subLabel = legacy.subLabel;

            if (validatedConfig) {
                const configured = buildConfiguredDisplay(rawFields, node.nodeType as NodeType, validatedConfig);
                // Only adopt configured value if it produced a non-empty string.
                // Empty string → keep legacy (prevents blank rows from bad config).
                if (configured.displayLabel !== null) displayLabel = configured.displayLabel;
                if (configured.subLabel !== null) subLabel = configured.subLabel;
            }

            return {
                nodeId: node.id,
                nodeType: node.nodeType,
                personId: node.personId ?? null,
                legalEntityId: node.legalEntityId ?? null,
                addressId: node.addressId ?? null,
                displayLabel,
                subLabel,
                source: node.source ?? "UNKNOWN",
                activeEdgeTypes,
                isPromoted,
                // Phase 1: structured field values from NODE_FIELD_REGISTRY.
                // Phase 3: consumed by buildConfiguredDisplay() when pickerConfig is present.
                rawFields,
            };
        });

        // Sort: purely alphabetical ascending.
        items.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));

        return { success: true, items };
    } catch (e: any) {
        console.error("[getGraphNodesForPicker]", e);
        return { success: false, error: String(e) };
    }
}
