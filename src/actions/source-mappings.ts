"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parsePath, resolvePathString, PathParseError } from "@/services/kyc/normalization/pathResolver";
import { SourceType, MappingTransformType, MasterFieldDefinition, SourceFieldMapping } from "@prisma/client";
import { captureMomentumObservation } from "./momentum";

// ── Types ──────────────────────────────────────────────────────────────

interface UpsertMappingInput {
    id?: string; // present for update
    sourceType: SourceType;
    /** RA scope identifier, e.g. 'RA000585'. null for GLEIF and global RA mappings. */
    sourceReference?: string | null;
    sourcePath: string;
    targetFieldNo: number;
    confidenceDefault?: number;
    transformType?: MappingTransformType;
    transformConfig?: any;
    priority?: number;
    notes?: string;
    /** RAW_PAYLOAD (resolve against RegistrySourcePayload) or BASELINE (legacy). */
    mappingScope?: string;
    /** Which raw payload subtype to resolve against, e.g. COMPANY_PROFILE, OFFICERS. */
    payloadSubtype?: string | null;
}


// ── Read Actions ───────────────────────────────────────────────────────

/**
 * V2 source mapping fetch — filters by both sourceType AND sourceReference.
 * This enables per-authority mapping views (e.g. only RA000585, only RA000192).
 *
 * Critical: sourceReference must use explicit null (not undefined) so Prisma
 * generates WHERE source_reference IS NULL rather than omitting the clause.
 *
 * @param sourceType      e.g. "GLEIF" or "REGISTRATION_AUTHORITY"
 * @param sourceReference e.g. "RA000585", "RA000192", or null for GLEIF
 */
export async function getSourceMappingsV2(
    sourceType: string,
    sourceReference: string | null
) {
    try {
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: {
                sourceType: sourceType as SourceType,
                // Use explicit null — Prisma treats `undefined` as "omit this clause",
                // which would return all rows regardless of sourceReference.
                sourceReference: sourceReference === null ? null : sourceReference,
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            include: {
                targetField: {
                    select: {
                        fieldNo: true,
                        fieldName: true,
                        appDataType: true,
                        isActive: true,
                    }
                }
            }
        });
        return { success: true, mappings };
    } catch (error: any) {
        console.error('getSourceMappingsV2 error:', error);
        return { success: false, error: error.message, mappings: [] };
    }
}

export async function getActiveFieldDefinitions() {
    try {
        const fields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { fieldNo: 'asc' }],
            select: { fieldNo: true, fieldName: true, appDataType: true, masterDataCategory: { select: { displayName: true } } }
        });
        return { success: true, fields };
    } catch (error: any) {
        return { success: false, error: error.message, fields: [] };
    }
}



// ── Mutation Actions ───────────────────────────────────────────────────

export async function upsertSourceMapping(input: UpsertMappingInput) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || null;

        // ── Validation ──
        const warnings: string[] = [];

        // 1. Parse path (structural validation)
        try {
            parsePath(input.sourcePath);
        } catch (e: any) {
            if (e instanceof PathParseError) {
                return { success: false, error: `Invalid source path: ${e.message}` };
            }
            return { success: false, error: "Invalid source path" };
        }

        // 1b. REGISTRATION_AUTHORITY: sourceReference (mappingSourceKey) is mandatory.
        // It must be set to the canonical source identity (e.g. "COMPANIES_HOUSE", "RA000192"),
        // NOT a raw GLEIF RA code. See RegistryAuthority.mappingSourceKey for resolution logic.
        if (input.sourceType === 'REGISTRATION_AUTHORITY' && !input.sourceReference) {
            return {
                success: false,
                error: 'sourceReference is required for REGISTRATION_AUTHORITY mappings. ' +
                    'Provide the mappingSourceKey (e.g. "COMPANIES_HOUSE", "RA000192"). ' +
                    'See RegistryAuthority.mappingSourceKey — not a GLEIF RA code.'
            };
        }

        // 2. Target field must exist and be active
        const targetField = await prisma.masterFieldDefinition.findUnique({
            where: { fieldNo: input.targetFieldNo }
        });
        if (!targetField) {
            return { success: false, error: `Target field F${input.targetFieldNo} does not exist` };
        }
        if (!targetField.isActive) {
            return { success: false, error: `Target field F${input.targetFieldNo} is inactive` };
        }

        // 3. Confidence range
        const confidence = input.confidenceDefault ?? 1.0;
        if (confidence < 0 || confidence > 1) {
            return { success: false, error: "Confidence must be between 0 and 1" };
        }

        // 4. Priority must be positive — default is source-aware if caller omits it
        // (GLEIF: 500, RA: 100, others: 100). This ensures new GLEIF mappings don't
        // accidentally outrank RA mappings which typically sit at 10–50.
        const SOURCE_PRIORITY_DEFAULTS: Record<string, number> = {
            GLEIF: 500, REGISTRATION_AUTHORITY: 100, AI_EXTRACTION: 800, SYSTEM_DERIVED: 900,
        };
        const priority = input.priority ?? SOURCE_PRIORITY_DEFAULTS[input.sourceType] ?? 100;
        if (priority < 1 || !Number.isInteger(priority)) {
            return { success: false, error: "Priority must be a positive integer" };
        }

        // 5. Check path resolves against sample payload (warning only)
        const sample = await prisma.sourceSamplePayload.findFirst({
            where: { sourceType: input.sourceType, isDefault: true }
        });
        if (sample) {
            const resolved = resolvePathString(sample.payload, input.sourcePath);
            if (resolved == null) {
                warnings.push("Path did not resolve against default sample payload");
            }
        }

        // 6. Check duplicate target (warning only)
        const existingForTarget = await prisma.sourceFieldMapping.findFirst({
            where: {
                sourceType: input.sourceType,
                targetFieldNo: input.targetFieldNo,
                isActive: true,
                ...(input.id ? { NOT: { id: input.id } } : {})
            }
        });
        if (existingForTarget) {
            warnings.push(`Field F${input.targetFieldNo} already has an active mapping for this source`);
        }

        // ── Fetch before state for audit ──
        let beforeState = null;
        if (input.id) {
            beforeState = await prisma.sourceFieldMapping.findUnique({
                where: { id: input.id }
            });
        }

        // ── Resolve ID by natural key if not explicitly provided ───────────
        // If no id was passed but a record with the same (sourceType, sourcePath,
        // targetFieldNo) already exists, treat this as an update rather than a
        // create. This makes the action idempotent and prevents false P2002 errors
        // when the UI is stale and the user re-submits a mapping that already exists.
        let resolvedId = input.id;
        if (!resolvedId) {
            const existing = await prisma.sourceFieldMapping.findFirst({
                where: {
                    sourceType: input.sourceType,
                    sourcePath: input.sourcePath,
                    targetFieldNo: input.targetFieldNo,
                },
                select: { id: true }
            });
            if (existing) {
                resolvedId = existing.id;
                beforeState = await prisma.sourceFieldMapping.findUnique({ where: { id: resolvedId } });
            }
        }

        // ── Scope defaults for REGISTRATION_AUTHORITY mappings ──
        // If the caller omits mappingScope, default to RAW_PAYLOAD for ALL RA sources.
        // Previously this only applied to COMPANIES_HOUSE — any other RA (RA000192, RA000242,
        // future jurisdictions) would fall through to the Prisma schema default of BASELINE,
        // which is incorrect: BASELINE only covers a thin extract (registeredAddress, legalName,
        // entityStatus) and never resolves officers, SIC codes, or profile fields.
        // GLEIF is not affected — GleifNormalizer ignores mappingScope entirely.
        const isRA = input.sourceType === 'REGISTRATION_AUTHORITY';
        const effectiveMappingScope = input.mappingScope
            ?? (isRA ? 'RAW_PAYLOAD' : undefined);
        const effectivePayloadSubtype = input.payloadSubtype !== undefined
            ? input.payloadSubtype
            : (isRA ? 'COMPANY_PROFILE' : undefined);

        // ── Upsert ──
        const data = {
            sourceType: input.sourceType,
            sourceReference: input.sourceReference ?? null,
            sourcePath: input.sourcePath,
            targetFieldNo: input.targetFieldNo,
            confidenceDefault: confidence,
            transformType: input.transformType || 'DIRECT',
            transformConfig: input.transformConfig || null,
            priority,
            notes: input.notes || null,
            updatedByUserId: userId,
            ...(effectiveMappingScope   ? { mappingScope:   effectiveMappingScope as any }   : {}),
            ...(effectivePayloadSubtype !== undefined ? { payloadSubtype: effectivePayloadSubtype as any } : {}),
            ...(resolvedId ? {} : { createdByUserId: userId }),
        };

        let mapping;
        if (resolvedId) {
            mapping = await prisma.sourceFieldMapping.update({
                where: { id: resolvedId },
                data,
                include: { targetField: true }
            });
        } else {
            mapping = await prisma.sourceFieldMapping.create({
                data,
                include: { targetField: true }
            });
        }

        // ── Audit Log ──
        try {
            await prisma.auditLog.create({
                data: {
                    actorUserId: userId,
                    action: resolvedId ? 'UPDATE' : 'CREATE',
                    entityType: 'SourceFieldMapping',
                    entityId: mapping.id,
                    sourceType: 'SYSTEM',
                    changedFields: ['sourceType', 'sourcePath', 'targetFieldNo'],
                    oldData: beforeState,
                    newData: { sourceType: data.sourceType, sourcePath: data.sourcePath, targetFieldNo: data.targetFieldNo }
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for source mapping upsert", e);
        }

        // ── Revalidate ──
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/mappings");

        // Step 10: Automated Observation Capture (Awaited for reliability in serverless)
        try {
            await captureMomentumObservation();
        } catch (err) {
            console.error("[upsertSourceMapping] Momentum capture failed:", err);
        }

        return { success: true, mapping, warnings };
    } catch (error: any) {
        console.error("upsertSourceMapping error:", error);
        return { success: false, error: error.message };
    }
}

export async function toggleSourceMapping(id: string, isActive: boolean) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || null;

        const before = await prisma.sourceFieldMapping.findUnique({ where: { id } });
        if (!before) return { success: false, error: "Mapping not found" };

        const mapping = await prisma.sourceFieldMapping.update({
            where: { id },
            data: { isActive, updatedByUserId: userId },
            include: { targetField: true }
        });

        // Audit
        try {
            await prisma.auditLog.create({
                data: {
                    actorUserId: userId,
                    action: 'UPDATE',
                    entityType: 'SourceFieldMapping',
                    entityId: id,
                    sourceType: 'SYSTEM',
                    changedFields: ['isActive'],
                    oldData: { isActive: before.isActive, sourceType: before.sourceType, targetFieldNo: before.targetFieldNo },
                    newData: { isActive, sourceType: before.sourceType, targetFieldNo: before.targetFieldNo }
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for toggle", e);
        }

        return { success: true, mapping };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
export async function deleteSourceMapping(id: string) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || null;

        const before = await prisma.sourceFieldMapping.findUnique({ where: { id } });
        if (!before) return { success: false, error: "Mapping not found" };

        await prisma.sourceFieldMapping.delete({
            where: { id }
        });

        // Audit
        try {
            await prisma.auditLog.create({
                data: {
                    actorUserId: userId,
                    action: 'DELETE',
                    entityType: 'SourceFieldMapping',
                    entityId: id,
                    sourceType: 'SYSTEM',
                    changedFields: [],
                    oldData: before,
                    newData: null
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for delete", e);
        }

        // ── Revalidate ──
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/mappings");

        // Step 10: Automated Observation Capture (Awaited for reliability in serverless)
        try {
            await captureMomentumObservation();
        } catch (err) {
            console.error("[deleteSourceMapping] Momentum capture failed:", err);
        }

        return { success: true };
    } catch (error: any) {
        console.error("deleteSourceMapping error:", error);
        return { success: false, error: error.message };
    }
}
