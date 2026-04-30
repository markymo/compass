"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";

/**
 * buildSchemaDefinition
 *
 * Constructs the full, serialised definition object for a MasterSchema snapshot.
 * Per architecture design (graph_field_binding_design.md §1.5), the snapshot must
 * include every field's:
 *   - Core metadata (fieldNo, fieldName, appDataType, isMultiValue, etc.)
 *   - Source field mappings (sourceType, sourcePath, transformType, confidence, priority)
 *   - Graph bindings (graphNodeType, writeBackEdgeType, etc.)
 *
 * This function is intentionally separate so it can be unit-tested and reused
 * by future schema validation tooling.
 */
async function buildSchemaDefinition(): Promise<Record<string, any>> {
    const fields = await (prisma as any).masterFieldDefinition.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { fieldNo: "asc" }],
        include: {
            sourceMappings: {
                where: { isActive: true },
                orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
                select: {
                    id: true,
                    sourceType: true,
                    sourcePath: true,
                    confidenceDefault: true,
                    transformType: true,
                    transformConfig: true,
                    priority: true,
                    notes: true,
                },
            },
            masterDataCategory: {
                select: { key: true, displayName: true },
            },
            optionSet: {
                select: { id: true, name: true, valueType: true, options: true },
            },
            graphBindings: {
                where: { isActive: true },
                select: {
                    id: true,
                    graphNodeType: true,
                    filterEdgeType: true,
                    filterActiveOnly: true,
                    writeBackEdgeType: true,
                    writeBackIsActive: true,
                    pickerLabel: true,
                    allowCreate: true,
                },
            },
        },
    });

    return {
        publishedAt: new Date().toISOString(),
        fields: fields.map((f: any) => ({
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            appDataType: f.appDataType,
            isMultiValue: f.isMultiValue,
            order: f.order,
            domain: f.domain,
            fmsbRef: f.fmsbRef ?? null,
            description: f.description ?? null,
            notes: f.notes ?? null,
            category: f.masterDataCategory
                ? { key: f.masterDataCategory.key, displayName: f.masterDataCategory.displayName }
                : null,
            optionSet: f.optionSet ?? null,
            // ── Source Mappings (now serialised into snapshot) ──────────────
            sourceMappings: f.sourceMappings.map((m: any) => ({
                id: m.id,
                sourceType: m.sourceType,
                sourcePath: m.sourcePath,
                confidenceDefault: m.confidenceDefault,
                transformType: m.transformType,
                transformConfig: m.transformConfig ?? null,
                priority: m.priority,
                notes: m.notes ?? null,
            })),
            // ── Graph Bindings (serialised into snapshot) ───────────────────
            graphBindings: (f.graphBindings ?? []).map((b: any) => ({
                id: b.id,
                graphNodeType: b.graphNodeType,
                filterEdgeType: b.filterEdgeType ?? null,
                filterActiveOnly: b.filterActiveOnly,
                writeBackEdgeType: b.writeBackEdgeType ?? null,
                writeBackIsActive: b.writeBackIsActive,
                pickerLabel: b.pickerLabel ?? null,
                allowCreate: b.allowCreate,
            })),
        })),
    };
}

/**
 * publishMasterSchema
 *
 * Creates a new MasterSchema version by serialising the current live state of
 * all active MasterFieldDefinitions (including their SourceFieldMappings) into
 * an immutable JSON snapshot.
 *
 * The newly created schema is NOT automatically set as active — the admin must
 * explicitly activate it. This gives a review window before the snapshot goes live.
 *
 * Returns the new schema record on success.
 */
export async function publishMasterSchema(): Promise<
    { success: true; schema: any; fieldCount: number; mappingCount: number } |
    { success: false; error: string }
> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || "SYSTEM";

        // 1. Determine next version number
        const latest = await prisma.masterSchema.findFirst({
            orderBy: { version: "desc" },
            select: { version: true },
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        // 2. Build the complete snapshot
        const definition = await buildSchemaDefinition();

        const fieldCount = definition.fields.length;
        const mappingCount = definition.fields.reduce(
            (sum: number, f: any) => sum + f.sourceMappings.length,
            0
        );

        // 3. Create the new (inactive) schema record
        const schema = await prisma.masterSchema.create({
            data: {
                version: nextVersion,
                isActive: false,   // Admin must explicitly activate
                definition: definition as any,
            },
        });

        // 4. Audit log
        try {
            await (prisma as any).auditLog.create({
                data: {
                    userId,
                    action: "MASTER_SCHEMA_PUBLISHED",
                    entityId: schema.id,
                    details: {
                        entityType: "MasterSchema",
                        version: nextVersion,
                        fieldCount,
                        mappingCount,
                        note: "Schema published but NOT yet activated. Activate separately.",
                    },
                },
            });
        } catch (e) {
            console.warn("[publishMasterSchema] Failed to write audit log:", e);
        }

        revalidatePath("/app/admin/master-data/system");
        return { success: true, schema, fieldCount, mappingCount };
    } catch (e: any) {
        console.error("[publishMasterSchema] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * activateMasterSchema
 *
 * Sets the given schema version as the active one, deactivating all others.
 * This is a separate step from publishing, giving admins a review window.
 *
 * WARNING: Activating a schema affects how all existing LE records are interpreted.
 * Existing FieldClaim records are not altered — they reference field numbers
 * which remain stable across schema versions.
 */
export async function activateMasterSchema(
    schemaId: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || "SYSTEM";

        const target = await prisma.masterSchema.findUnique({
            where: { id: schemaId },
        });
        if (!target) {
            return { success: false, error: "Schema not found" };
        }
        if (target.isActive) {
            return { success: false, error: "Schema is already active" };
        }

        // Deactivate all, then activate the target — wrapped in a transaction
        await prisma.$transaction([
            prisma.masterSchema.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            }),
            prisma.masterSchema.update({
                where: { id: schemaId },
                data: { isActive: true },
            }),
        ]);

        // Audit log
        try {
            await (prisma as any).auditLog.create({
                data: {
                    userId,
                    action: "MASTER_SCHEMA_ACTIVATED",
                    entityId: schemaId,
                    details: {
                        entityType: "MasterSchema",
                        version: target.version,
                        note: "Schema activated. All new LE records will reference this version.",
                    },
                },
            });
        } catch (e) {
            console.warn("[activateMasterSchema] Failed to write audit log:", e);
        }

        revalidatePath("/app/admin/master-data/system");
        return { success: true };
    } catch (e: any) {
        console.error("[activateMasterSchema] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * getMasterSchemaVersions
 *
 * Returns all schema versions in descending order, with summary stats derived
 * from the serialised definition. Used by the System Tools admin UI.
 */
export async function getMasterSchemaVersions(): Promise<{
    success: boolean;
    versions?: Array<{
        id: string;
        version: number;
        isActive: boolean;
        publishedAt: string;
        fieldCount: number;
        mappingCount: number;
        createdAt: Date;
    }>;
    error?: string;
}> {
    try {
        const schemas = await prisma.masterSchema.findMany({
            orderBy: { version: "desc" },
            select: { id: true, version: true, isActive: true, definition: true, createdAt: true },
        });

        const versions = schemas.map((s: any) => {
            const def = s.definition as any;
            const fields: any[] = def?.fields ?? [];
            const mappingCount = fields.reduce(
                (sum: number, f: any) => sum + (f.sourceMappings?.length ?? 0),
                0
            );
            return {
                id: s.id,
                version: s.version,
                isActive: s.isActive,
                publishedAt: def?.publishedAt ?? s.createdAt.toISOString(),
                fieldCount: fields.length,
                mappingCount,
                createdAt: s.createdAt,
            };
        });

        return { success: true, versions };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
}
