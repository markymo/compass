"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parsePath, resolveDotPath, discoverPaths, resolvePathString, PathParseError } from "@/services/kyc/normalization/pathResolver";
import { applyTransform } from "@/services/kyc/normalization/transforms";
import { SourceType, MappingTransformType, MasterFieldDefinition, SourceFieldMapping } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────

interface UpsertMappingInput {
    id?: string; // present for update
    sourceType: SourceType;
    sourcePath: string;
    targetFieldNo: number;
    confidenceDefault?: number;
    transformType?: MappingTransformType;
    transformConfig?: any;
    priority?: number;
    notes?: string;
}

interface MappingTestResult {
    mappingId: string;
    sourcePath: string;
    targetFieldNo: number;
    targetFieldName: string;
    resolvedValue: any;
    transformedValue: any;
    confidence: number;
    warnings: string[];
    resolved: boolean;
}

// ── Read Actions ───────────────────────────────────────────────────────

export async function getSourceMappings(sourceType: string) {
    try {
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: { sourceType: sourceType as SourceType },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            include: {
                targetField: {
                    select: { fieldNo: true, fieldName: true, appDataType: true, isActive: true }
                }
            }
        });
        return { success: true, mappings };
    } catch (error: any) {
        console.error("getSourceMappings error:", error);
        return { success: false, error: error.message, mappings: [] };
    }
}

export async function getActiveFieldDefinitions() {
    try {
        const fields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: { fieldNo: 'asc' },
            select: { fieldNo: true, fieldName: true, appDataType: true }
        });
        return { success: true, fields };
    } catch (error: any) {
        return { success: false, error: error.message, fields: [] };
    }
}

export async function getSamplePayloads(sourceType: string) {
    try {
        const payloads = await prisma.sourceSamplePayload.findMany({
            where: { sourceType: sourceType as SourceType },
            orderBy: { createdAt: 'asc' },
            select: { id: true, label: true, isDefault: true, createdAt: true }
        });
        return { success: true, payloads };
    } catch (error: any) {
        return { success: false, error: error.message, payloads: [] };
    }
}

export async function getAvailableSourcePaths(sourceType: string) {
    try {
        // Find default sample payload
        const sample = await prisma.sourceSamplePayload.findFirst({
            where: { sourceType: sourceType as SourceType, isDefault: true }
        });
        if (!sample) {
            return { success: true, paths: [], message: "No sample payload available for path discovery" };
        }
        const paths = discoverPaths(sample.payload);
        return { success: true, paths };
    } catch (error: any) {
        return { success: false, error: error.message, paths: [] };
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

        // 4. Priority must be positive
        const priority = input.priority ?? 100;
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

        // ── Upsert ──
        const data = {
            sourceType: input.sourceType,
            sourcePath: input.sourcePath,
            targetFieldNo: input.targetFieldNo,
            confidenceDefault: confidence,
            transformType: input.transformType || 'DIRECT',
            transformConfig: input.transformConfig || null,
            priority,
            notes: input.notes || null,
            updatedByUserId: userId,
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
                    userId: userId || 'SYSTEM',
                    action: resolvedId ? 'SOURCE_MAPPING_UPDATE' : 'SOURCE_MAPPING_CREATE',
                    entityId: mapping.id,
                    details: {
                        entityType: 'SourceFieldMapping',
                        before: beforeState,
                        after: { sourceType: data.sourceType, sourcePath: data.sourcePath, targetFieldNo: data.targetFieldNo },
                        sourceType: input.sourceType,
                        targetFieldNo: input.targetFieldNo
                    }
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for source mapping upsert", e);
        }

        // ── Revalidate ──
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/fields");

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
                    userId: userId || 'SYSTEM',
                    action: 'SOURCE_MAPPING_TOGGLE',
                    entityId: id,
                    details: {
                        entityType: 'SourceFieldMapping',
                        before: { isActive: before.isActive },
                        after: { isActive },
                        sourceType: before.sourceType,
                        targetFieldNo: before.targetFieldNo
                    }
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
                    userId: userId || 'SYSTEM',
                    action: 'SOURCE_MAPPING_DELETE',
                    entityId: id,
                    details: {
                        entityType: 'SourceFieldMapping',
                        before: before,
                        after: null,
                        sourceType: before.sourceType,
                        targetFieldNo: before.targetFieldNo
                    }
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for delete", e);
        }

        // ── Revalidate ──
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/fields");

        return { success: true };
    } catch (error: any) {
        console.error("deleteSourceMapping error:", error);
        return { success: false, error: error.message };
    }
}

// ── Test / Preview Actions ─────────────────────────────────────────────

export async function testSourceMapping(mappingId: string, samplePayloadId?: string) {
    try {
        const mapping = await prisma.sourceFieldMapping.findUnique({
            where: { id: mappingId },
            include: { targetField: true }
        });
        if (!mapping) return { success: false, error: "Mapping not found" };

        // Get sample payload
        let sample;
        if (samplePayloadId) {
            sample = await prisma.sourceSamplePayload.findUnique({ where: { id: samplePayloadId } });
        } else {
            sample = await prisma.sourceSamplePayload.findFirst({
                where: { sourceType: mapping.sourceType, isDefault: true }
            });
        }

        if (!sample) {
            return { success: false, error: "No sample payload found. Upload a sample to test mappings." };
        }

        const warnings: string[] = [];
        let resolvedValue = null;
        let transformedValue = null;
        let confidence = mapping.confidenceDefault;

        try {
            const segments = parsePath(mapping.sourcePath);
            resolvedValue = resolveDotPath(sample.payload, segments);
        } catch (e: any) {
            warnings.push(`Path parse error: ${e.message}`);
        }

        if (resolvedValue != null) {
            const result = applyTransform(resolvedValue, mapping.transformType, mapping.transformConfig);
            transformedValue = result.value;
            if (result.confidencePenalty > 0) {
                confidence = confidence * (1 - result.confidencePenalty);
                warnings.push(`Transform applied confidence penalty: -${(result.confidencePenalty * 100).toFixed(0)}%`);
            }
        } else {
            warnings.push("Path resolved to null");
        }

        const testResult: MappingTestResult = {
            mappingId: mapping.id,
            sourcePath: mapping.sourcePath,
            targetFieldNo: mapping.targetFieldNo,
            targetFieldName: mapping.targetField?.fieldName || `Field ${mapping.targetFieldNo}`,
            resolvedValue,
            transformedValue,
            confidence,
            warnings,
            resolved: resolvedValue != null
        };

        return { success: true, result: testResult };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function testAllSourceMappings(sourceType: string, samplePayloadId?: string) {
    try {
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: { sourceType: sourceType as SourceType, isActive: true },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            include: { targetField: true }
        });

        // Get sample payload
        let sample;
        if (samplePayloadId) {
            sample = await prisma.sourceSamplePayload.findUnique({ where: { id: samplePayloadId } });
        } else {
            sample = await prisma.sourceSamplePayload.findFirst({
                where: { sourceType: sourceType as SourceType, isDefault: true }
            });
        }

        if (!sample) {
            return { success: false, error: "No sample payload found", results: [], summary: null };
        }

        const results: MappingTestResult[] = [];
        let resolvedCount = 0;
        let unresolvedCount = 0;

        for (const mapping of mappings) {
            const warnings: string[] = [];
            let resolvedValue = null;
            let transformedValue = null;
            let confidence = mapping.confidenceDefault;

            try {
                const segments = parsePath(mapping.sourcePath);
                resolvedValue = resolveDotPath(sample.payload, segments);
            } catch (e: any) {
                warnings.push(`Path error: ${e.message}`);
            }

            if (resolvedValue != null) {
                const result = applyTransform(resolvedValue, mapping.transformType, mapping.transformConfig);
                transformedValue = result.value;
                if (result.confidencePenalty > 0) {
                    confidence = confidence * (1 - result.confidencePenalty);
                    warnings.push(`Transform penalty: -${(result.confidencePenalty * 100).toFixed(0)}%`);
                }
                resolvedCount++;
            } else {
                warnings.push("Resolved to null");
                unresolvedCount++;
            }

            results.push({
                mappingId: mapping.id,
                sourcePath: mapping.sourcePath,
                targetFieldNo: mapping.targetFieldNo,
                targetFieldName: mapping.targetField?.fieldName || `Field ${mapping.targetFieldNo}`,
                resolvedValue,
                transformedValue,
                confidence,
                warnings,
                resolved: resolvedValue != null
            });
        }

        return {
            success: true,
            results,
            summary: {
                total: mappings.length,
                resolved: resolvedCount,
                unresolved: unresolvedCount,
                candidateCount: resolvedCount
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message, results: [], summary: null };
    }
}

// ── Bootstrap Action ───────────────────────────────────────────────────

const DEFAULT_GLEIF_MAPPINGS = [
    { sourcePath: 'lei', targetFieldNo: 2, confidenceDefault: 1.0, priority: 10, notes: 'LEI code' },
    { sourcePath: 'entity.legalName.name', targetFieldNo: 3, confidenceDefault: 1.0, priority: 10, notes: 'Legal entity name' },
    { sourcePath: 'entity.legalAddress.addressLines[0]', targetFieldNo: 6, confidenceDefault: 0.9, priority: 20, notes: 'Registered address line 1' },
    { sourcePath: 'entity.legalAddress.city', targetFieldNo: 7, confidenceDefault: 0.9, priority: 20, notes: 'Registered address city' },
    { sourcePath: 'entity.legalAddress.region', targetFieldNo: 8, confidenceDefault: 0.9, priority: 20, notes: 'Registered address region' },
    { sourcePath: 'entity.legalAddress.country', targetFieldNo: 9, confidenceDefault: 1.0, priority: 20, notes: 'Registered address country' },
    { sourcePath: 'entity.legalAddress.postalCode', targetFieldNo: 10, confidenceDefault: 0.9, priority: 20, notes: 'Registered address postcode' },
    { sourcePath: 'entity.status', targetFieldNo: 26, confidenceDefault: 1.0, priority: 10, notes: 'Entity status' },
    { sourcePath: 'entity.category', targetFieldNo: 19, confidenceDefault: 1.0, priority: 10, notes: 'GLEIF entity category' },
    { sourcePath: 'entity.creationDate', targetFieldNo: 27, confidenceDefault: 1.0, transformType: 'DATE_TO_ISO' as any, priority: 10, notes: 'Entity creation/incorporation date' },
];

const DEFAULT_REGISTRATION_AUTHORITY_MAPPINGS = [
    { sourcePath: 'entityName', targetFieldNo: 3, confidenceDefault: 1.0, priority: 10, notes: 'Legal entity name' },
    { sourcePath: 'entityStatus', targetFieldNo: 26, confidenceDefault: 1.0, priority: 10, notes: 'Entity status' },
    { sourcePath: 'incorporationDate', targetFieldNo: 27, confidenceDefault: 1.0, transformType: 'DATE_TO_ISO' as any, priority: 10, notes: 'Incorporation date' },
    { sourcePath: 'registeredAddress.lines[0]', targetFieldNo: 6, confidenceDefault: 0.9, priority: 20, notes: 'Address line 1' },
    { sourcePath: 'registeredAddress.city', targetFieldNo: 7, confidenceDefault: 0.9, priority: 20, notes: 'Address city' },
    { sourcePath: 'registeredAddress.region', targetFieldNo: 8, confidenceDefault: 0.9, priority: 20, notes: 'Address region' },
    { sourcePath: 'registeredAddress.country', targetFieldNo: 9, confidenceDefault: 1.0, priority: 20, notes: 'Address country' },
    { sourcePath: 'registeredAddress.postalCode', targetFieldNo: 10, confidenceDefault: 0.9, priority: 20, notes: 'Address postal code' },
];

// Sample GLEIF canonical payload for preview
const SAMPLE_GLEIF_PAYLOAD = {
    lei: "549300MLUDYVRQOOXS22",
    entity: {
        legalName: { name: "HSBC Holdings plc", language: "en" },
        legalAddress: {
            language: "en",
            addressLines: ["8 Canada Square"],
            city: "London",
            region: "GB-LND",
            country: "GB",
            postalCode: "E14 5HQ"
        },
        headquartersAddress: {
            language: "en",
            addressLines: ["8 Canada Square"],
            city: "London",
            region: "GB-LND",
            country: "GB",
            postalCode: "E14 5HQ"
        },
        registeredAt: { id: "RA000585" },
        registeredAs: "617987",
        jurisdiction: "GB",
        category: "GENERAL",
        status: "ACTIVE",
        creationDate: "1959-01-01T00:00:00.000Z"
    },
    registration: {
        initialRegistrationDate: "2012-06-06T15:53:00.000Z",
        lastUpdateDate: "2024-06-20T21:31:00.000Z",
        status: "ISSUED",
        nextRenewalDate: "2025-06-19T21:31:00.000Z",
        managingLOU: "EVK05KS7XY1DEII3R011"
    }
};

// Sample Registration Authority payload (Super Schema format)
const SAMPLE_REGISTRATION_AUTHORITY_PAYLOAD = {
    sourceType: "REGISTRATION_AUTHORITY",
    registryKey: "GB_COMPANIES_HOUSE",
    registryAuthorityId: "RA000585",
    sourceRecordId: "000617987",
    fetchedAt: "2026-03-09T12:00:00.000Z",
    entityName: "PAGOS LTD",
    entityStatus: "active",
    incorporationDate: "2010-05-15T00:00:00.000Z",
    legalForm: "Private Limited Company",
    registeredAddress: {
        lines: ["123 Business Way", "Tech Park"],
        city: "London",
        postalCode: "EC1A 1BB",
        country: "United Kingdom"
    },
    identifiers: [
        { type: "COMPANY_NUMBER", value: "000617987" }
    ],
    sicCodes: [
        { code: "62020", description: "Information technology consultancy activities" }
    ]
};

export async function bootstrapDefaultMappings(sourceType: string) {
    if (sourceType !== 'GLEIF' && sourceType !== 'REGISTRATION_AUTHORITY') {
        return { success: false, error: `Bootstrap not available for ${sourceType}.` };
    }

    const defaultMappings = sourceType === 'GLEIF' ? DEFAULT_GLEIF_MAPPINGS : DEFAULT_REGISTRATION_AUTHORITY_MAPPINGS;
    const samplePayload = sourceType === 'GLEIF' ? SAMPLE_GLEIF_PAYLOAD : SAMPLE_REGISTRATION_AUTHORITY_PAYLOAD;
    const sampleLabel = sourceType === 'GLEIF' ? "HSBC Holdings plc (Default Preview)" : "PAGOS LTD (Canonical Sample)";

    try {
        const identity = await getIdentity();
        const userId = identity?.userId || null;

        // Transaction-safe: re-check count inside transaction
        const result = await prisma.$transaction(async (tx: any) => {
            const existingCount = await tx.sourceFieldMapping.count({
                where: { sourceType: sourceType as SourceType }
            });

            if (existingCount > 0) {
                return { alreadyExists: true, count: existingCount };
            }

            // Insert all default mappings
            for (const mapping of defaultMappings) {
                await tx.sourceFieldMapping.create({
                    data: {
                        sourceType: sourceType as SourceType,
                        sourcePath: mapping.sourcePath,
                        targetFieldNo: mapping.targetFieldNo,
                        confidenceDefault: mapping.confidenceDefault,
                        priority: mapping.priority,
                        notes: mapping.notes,
                        transformType: (mapping as any).transformType || 'DIRECT',
                        isActive: true,
                        createdByUserId: userId,
                        updatedByUserId: userId,
                    }
                });
            }

            // Insert sample payload
            await tx.sourceSamplePayload.create({
                data: {
                    sourceType: sourceType as SourceType,
                    label: sampleLabel,
                    payload: samplePayload,
                    isDefault: true,
                }
            });

            return { alreadyExists: false, count: defaultMappings.length };
        });

        if (result.alreadyExists) {
            return { success: false, error: `${result.count} mappings already exist for ${sourceType}. Bootstrap is only available when no mappings exist.` };
        }

        // Audit
        try {
            await prisma.auditLog.create({
                data: {
                    userId: userId || 'SYSTEM',
                    action: 'SOURCE_MAPPING_BOOTSTRAP',
                    entityId: sourceType,
                    details: {
                        entityType: 'SourceFieldMapping',
                        before: null,
                        after: { mappingCount: result.count, sourceType },
                        sourceType
                    }
                }
            });
        } catch (e) {
            console.warn("Failed to write audit log for bootstrap", e);
        }

        return { success: true, message: `Created ${result.count} default mappings and 1 sample payload for ${sourceType}` };
    } catch (error: any) {
        console.error("bootstrapDefaultMappings error:", error);
        return { success: false, error: error.message };
    }
}
