"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CODE_DEFAULTS, SYSTEM_SETTING_KEY } from "@/lib/kyc/source-priority-config";

export async function getSystemSetting(key: string) {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key }
        });
        return setting?.value ?? null;
    } catch (e) {
        console.error(`Failed to fetch SystemSetting for key: ${key}`, e);
        return null;
    }
}

export async function setSystemSetting(key: string, value: any) {
    try {
        await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        return { success: true };
    } catch (e) {
        console.error(`Failed to set SystemSetting for key: ${key}`, e);
        return { success: false, error: "Failed to save setting" };
    }
}

// ── Source Priority Config ──────────────────────────────────────────────────

export interface RegistryAuthorityMeta {
    id: string;          // e.g. "RA000585"
    name: string;        // e.g. "Companies House"
    countryCode: string; // e.g. "GB"
}

export interface SourcePriorityData {
    /** Global fallback priorities by SourceType enum value. */
    sourceTypePriorities: Record<string, number>;
    /** Per-RA fallback priorities, keyed by RA ID (e.g. "RA000585"). */
    registryPriorities: Record<string, number>;
    /** Live RA metadata for display (name, country). */
    registryAuthorities: RegistryAuthorityMeta[];
}

/**
 * Loads all data needed for the SourcePriorityPanel:
 *  - Source type defaults (merged DB + code)
 *  - Per-RA defaults (merged DB + 500 default)
 *  - Live RegistryAuthority records + any RA IDs in source_field_mappings
 */
export async function getSourcePriorityDefaults(): Promise<SourcePriorityData> {
    // 1. Load stored setting
    let stored: Record<string, number> = {};
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: SYSTEM_SETTING_KEY },
        });
        if (setting?.value && typeof setting.value === "object") {
            stored = setting.value as Record<string, number>;
        }
    } catch (e) {
        console.error("[system] Failed to load source priority setting:", e);
    }

    // 2. Source-type level priorities (enum values only)
    const sourceTypePriorities: Record<string, number> = {
        ...CODE_DEFAULTS,
        ...Object.fromEntries(
            Object.entries(stored).filter(([k]) => !k.startsWith("RA"))
        ),
    };

    // 3. Load all known RegistryAuthority records
    const dbRAs = await prisma.registryAuthority.findMany({
        orderBy: [{ countryCode: "asc" }, { id: "asc" }],
        select: { id: true, name: true, countryCode: true },
    });

    // 4. Also include any RA IDs referenced in source_field_mappings but not in registry_authorities
    const mappingRARefs = await (prisma as any).sourceFieldMapping.findMany({
        where: { sourceType: "REGISTRATION_AUTHORITY", sourceReference: { not: null } },
        select: { sourceReference: true },
        distinct: ["sourceReference"],
    }) as Array<{ sourceReference: string }>;

    const knownRAIds = new Set(dbRAs.map((r: any) => r.id));
    for (const { sourceReference } of mappingRARefs) {
        if (sourceReference && !knownRAIds.has(sourceReference)) {
            dbRAs.push({ id: sourceReference, name: sourceReference, countryCode: "??" });
            knownRAIds.add(sourceReference);
        }
    }

    // 5. Per-RA priorities (stored RA keys override 500 default)
    const registryPriorities: Record<string, number> = {};
    for (const ra of dbRAs) {
        registryPriorities[ra.id] = stored[ra.id] ?? 500;
    }

    return {
        sourceTypePriorities,
        registryPriorities,
        registryAuthorities: dbRAs,
    };
}

/**
 * Persists the combined source-type + per-RA priority table to SystemSetting.
 */
export async function saveSourcePriorityDefaults(
    priorities: Record<string, number>
): Promise<{ success: boolean; error?: string }> {
    for (const [source, priority] of Object.entries(priorities)) {
        if (!Number.isInteger(priority) || priority <= 0) {
            return { success: false, error: `Invalid priority for ${source}: must be a positive integer` };
        }
    }
    try {
        await prisma.systemSetting.upsert({
            where: { key: SYSTEM_SETTING_KEY },
            update: { value: priorities },
            create: { key: SYSTEM_SETTING_KEY, value: priorities },
        });
        revalidatePath("/app/admin/super");
        return { success: true };
    } catch (e) {
        console.error("[system] Failed to save source priority defaults:", e);
        return { success: false, error: "Database error — failed to save" };
    }
}
