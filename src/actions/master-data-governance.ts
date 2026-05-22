"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateDefinitionCache } from "@/services/masterData/definitionService";
import { captureMomentumObservation } from "./momentum";
import { isSystemAdmin } from "./admin";

/**
 * toggleFieldActive: Toggles the active state of a master field definition.
 */
export async function toggleFieldActive(fieldNo: number, isActive: boolean) {
    try {
        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data: { isActive }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e) {
        console.error("[toggleFieldActive] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * toggleGroupActive: Toggles the active state of a master field group.
 */
export async function toggleGroupActive(id: string, isActive: boolean) {
    try {
        await (prisma as any).masterFieldGroup.update({
            where: { id },
            data: { isActive }
        });
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true };
    } catch (e) {
        console.error("[toggleGroupActive] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * clearDefinitionCache: Forces a refresh of the definition cache.
 */
export async function clearDefinitionCache() {
    try {
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        return { success: true };
    } catch (e) {
        console.error("[clearDefinitionCache] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * updateMasterField: Updates metadata for a master field definition.
 */
export async function updateMasterField(
    fieldNo: number,
    data: {
        fieldName?: string;
        categoryId?: string | null;
        newCategoryName?: string;
        notes?: string;
        description?: string;
        fmsbRef?: string;
        domain?: string[];
        isActive?: boolean;
        order?: number;
        appDataType?: string;
        isMultiValue?: boolean;
        optionSetId?: string | null;
    }
) {
    try {
        let finalData = { ...data };
        delete finalData.newCategoryName;

        if (data.newCategoryName) {
            const normalize = (name: string) => name.trim().toLowerCase().replace(/[\s\W]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            let baseKey = normalize(data.newCategoryName);
            
            let key = baseKey;
            let suffix = 2;
            let exists = await (prisma as any).masterDataCategory.findUnique({ where: { key }});
            while (exists) {
                key = `${baseKey}-${suffix}`;
                suffix++;
                exists = await (prisma as any).masterDataCategory.findUnique({ where: { key }});
            }

            const maxOrderCat = await (prisma as any).masterDataCategory.findFirst({ orderBy: { order: 'desc' }});
            const newCat = await (prisma as any).masterDataCategory.create({
                data: {
                    key: key,
                    displayName: data.newCategoryName.trim(),
                    order: (maxOrderCat?.order || 0) + 1
                }
            });
            finalData.categoryId = newCat.id;
        }

        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data: finalData
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");

        // Step 10: Automated Observation Capture (Awaited for reliability in serverless)
        try {
            await captureMomentumObservation();
        } catch (err) {
            console.error("[updateMasterField] Momentum capture failed:", err);
        }

        return { success: true };
    } catch (e) {
        console.error("[updateMasterField] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * createMasterField: Creates a new master field definition.
 */
export async function createMasterField(data: {
    fieldName: string;
    appDataType: string;
    categoryId?: string;
    newCategoryName?: string;
    description?: string;
    notes?: string;
    fmsbRef?: string;
    domain?: string[];
    isActive?: boolean;
    order?: number;
    isMultiValue?: boolean;
    optionSetId?: string | null;
}) {
    try {
        // Sanitize: empty strings from form selects must be treated as absent.
        // An empty string is not a valid UUID and will violate the FK constraint
        // on master_field_definitions_categoryId_fkey.
        const sanitizedCategoryId  = data.categoryId?.trim()       || undefined;
        const sanitizedNewCategory = data.newCategoryName?.trim()   || undefined;

        let finalCategoryId = sanitizedCategoryId;

        if (sanitizedNewCategory) {
            const normalize = (name: string) => name.trim().toLowerCase().replace(/[\s\W]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            let baseKey = normalize(sanitizedNewCategory);
            
            let key = baseKey;
            let suffix = 2;
            let exists = await (prisma as any).masterDataCategory.findUnique({ where: { key }});
            while (exists) {
                key = `${baseKey}-${suffix}`;
                suffix++;
                exists = await (prisma as any).masterDataCategory.findUnique({ where: { key }});
            }

            const maxOrderCat = await (prisma as any).masterDataCategory.findFirst({ orderBy: { order: 'desc' }});
            const newCat = await (prisma as any).masterDataCategory.create({
                data: {
                    key: key,
                    displayName: sanitizedNewCategory,
                    order: (maxOrderCat?.order || 0) + 1
                }
            });
            finalCategoryId = newCat.id;
        }

        // Fix PosgreSQL sequence drift by manually deriving the next PK
        const maxField = await (prisma as any).masterFieldDefinition.findFirst({
            orderBy: { fieldNo: 'desc' },
            select: { fieldNo: true }
        });
        const nextFieldNo = (maxField?.fieldNo || 0) + 1;

        const field = await (prisma as any).masterFieldDefinition.create({
            data: {
                fieldNo: nextFieldNo,
                fieldName: data.fieldName,
                appDataType: data.appDataType,
                categoryId: finalCategoryId,
                description: data.description,
                notes: data.notes,
                fmsbRef: data.fmsbRef,
                domain: data.domain || [],
                isActive: data.isActive !== undefined ? data.isActive : true,
                order: data.order ?? 999,
                isMultiValue: data.isMultiValue || false,
                optionSetId: data.optionSetId || undefined,
            }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true, field };
    } catch (e) {
        console.error("[createMasterField] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * createMasterFieldGroup: Creates a new master field group.
 */
export async function createMasterFieldGroup(data: {
    key: string;
    label: string;
    description?: string;
    category?: string;
    order?: number;
}) {
    try {
        const group = await (prisma as any).masterFieldGroup.create({ data });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true, group };
    } catch (e) {
        console.error("[createMasterFieldGroup] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * updateMasterFieldGroup: Updates metadata for a master field group.
 */
export async function updateMasterFieldGroup(
    id: string,
    data: {
        label?: string;
        description?: string;
        category?: string;
        isActive?: boolean;
        order?: number;
    }
) {
    try {
        await (prisma as any).masterFieldGroup.update({
            where: { id },
            data
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/groups");
        return { success: true };
    } catch (e) {
        console.error("[updateMasterFieldGroup] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * renameCustomField: Updates the label of a CustomFieldDefinition.
 * Available to LE_Admin and LE_User roles.
 */
export async function renameCustomField(
    customFieldId: string,
    newLabel: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!newLabel.trim()) {
            return { success: false, error: "Label cannot be empty" };
        }

        await prisma.customFieldDefinition.update({
            where: { id: customFieldId },
            data: { label: newLabel.trim() }
        });

        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        // Revalidate workbench pages broadly
        revalidatePath("/app/le", "layout");

        return { success: true };
    } catch (e) {
        console.error("[renameCustomField] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * renameMasterDataCategory: Updates the displayName of a MasterDataCategory.
 * The category key is deliberately left unchanged to avoid breaking any published
 * schema snapshots, AI category lists, or momentum scope references that use it.
 *
 * Guarded: platform admin only.
 */
export async function renameMasterDataCategory(
    id: string,
    displayName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const admin = await isSystemAdmin();
        if (!admin) {
            return { success: false, error: "Unauthorized: platform admin required" };
        }

        const trimmed = displayName.trim();
        if (!trimmed) {
            return { success: false, error: "Category name cannot be empty" };
        }
        if (trimmed.length > 80) {
            return { success: false, error: "Category name must be 80 characters or fewer" };
        }

        const existing = await (prisma as any).masterDataCategory.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, error: "Category not found" };
        }

        await (prisma as any).masterDataCategory.update({
            where: { id },
            data: { displayName: trimmed }
        });

        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data");

        return { success: true };
    } catch (e) {
        console.error("[renameMasterDataCategory] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * getCategoryImpactSummary: Returns a read-only count of all downstream references
 * for a category. Called when the archive modal opens so the user can make an
 * informed decision before proceeding.
 */
export async function getCategoryImpactSummary(categoryId: string): Promise<{
    success: boolean;
    error?: string;
    summary?: {
        fieldCount: number;
        activeSourceMappings: number;
        totalSourceMappings: number;
        fieldClaimCount: number;
        questionCount: number;
        isEmptyCategory: boolean;
        hasLiveReferences: boolean;
    };
}> {
    try {
        const category = await (prisma as any).masterDataCategory.findUnique({
            where: { id: categoryId },
            include: {
                fields: {
                    include: { sourceMappings: true }
                }
            }
        });

        if (!category) {
            return { success: false, error: "Category not found" };
        }

        const fieldNos: number[] = category.fields.map((f: any) => f.fieldNo);
        const fieldCount = fieldNos.length;
        const activeSourceMappings = category.fields.reduce(
            (acc: number, f: any) => acc + f.sourceMappings.filter((m: any) => m.isActive).length, 0
        );
        const totalSourceMappings = category.fields.reduce(
            (acc: number, f: any) => acc + f.sourceMappings.length, 0
        );

        let fieldClaimCount = 0;
        let questionCount = 0;

        if (fieldNos.length > 0) {
            const claimRes = await (prisma as any).$queryRaw`
                SELECT COUNT(*)::int AS cnt FROM field_claims WHERE "fieldNo" = ANY(${fieldNos})
            `;
            fieldClaimCount = Number(claimRes[0]?.cnt ?? 0);

            const qRes = await (prisma as any).$queryRaw`
                SELECT COUNT(*)::int AS cnt FROM "Question" WHERE "masterFieldNo" = ANY(${fieldNos})
            `;
            questionCount = Number(qRes[0]?.cnt ?? 0);
        }

        const hasLiveReferences = fieldClaimCount > 0 || questionCount > 0 || activeSourceMappings > 0;
        const isEmptyCategory = fieldCount === 0;

        return {
            success: true,
            summary: {
                fieldCount,
                activeSourceMappings,
                totalSourceMappings,
                fieldClaimCount,
                questionCount,
                isEmptyCategory,
                hasLiveReferences,
            }
        };
    } catch (e) {
        console.error("[getCategoryImpactSummary] Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * retireMasterDataCategory: Archives a category and retires all its fields and active
 * source mappings in a single transaction. This is the safe alternative to hard delete.
 *
 * INVARIANT: FieldClaim rows and Question.masterFieldNo links are intentionally left
 * intact. They reference fieldNo as bare integers with no FK constraint — orphaning
 * them would break historical explainability. Retired fields remain permanently
 * resolvable by fieldNo for any historical query.
 *
 * Hard delete policy:
 *   - Category has zero fields: caller may pass { forceHardDelete: true }
 *   - Category has fields with live references: retirement only, always
 *   - Category has fields with zero live references: retirement by default
 *     (hard delete never offered in this version)
 *
 * Guarded: platform admin only.
 */
export async function retireMasterDataCategory(
    categoryId: string,
    archiveReason: string,
    options?: { forceHardDelete?: boolean }
): Promise<{ success: boolean; error?: string; hardDeleted?: boolean }> {
    try {
        const admin = await isSystemAdmin();
        if (!admin) {
            return { success: false, error: "Unauthorized: platform admin required" };
        }

        const reason = archiveReason.trim();
        if (!reason) {
            return { success: false, error: "Archive reason is required" };
        }
        if (reason.length > 500) {
            return { success: false, error: "Archive reason must be 500 characters or fewer" };
        }

        // Resolve user identity for audit trail
        const { getIdentity } = await import("@/lib/auth");
        const identity = await getIdentity();
        const actorId = identity?.userId ?? null;

        const category = await (prisma as any).masterDataCategory.findUnique({
            where: { id: categoryId },
            include: { fields: { include: { sourceMappings: true } } }
        });

        if (!category) {
            return { success: false, error: "Category not found" };
        }
        if (!category.isActive) {
            return { success: false, error: "Category is already archived" };
        }

        const fieldNos: number[] = category.fields.map((f: any) => f.fieldNo);

        // --- Hard delete path: only allowed when the category has zero fields ---
        if (options?.forceHardDelete && fieldNos.length === 0) {
            await (prisma as any).masterDataCategory.delete({ where: { id: categoryId } });
            invalidateDefinitionCache();
            revalidatePath("/app/admin/master-data/manager");
            revalidatePath("/app/admin/master-data");
            return { success: true, hardDeleted: true };
        }

        // --- Retirement path (all other cases) ---
        const now = new Date();

        await (prisma as any).$transaction(async (tx: any) => {
            // 1. Archive the category
            await tx.masterDataCategory.update({
                where: { id: categoryId },
                data: {
                    isActive: false,
                    archivedAt: now,
                    archivedById: actorId,
                    archiveReason: reason,
                }
            });

            // 2. Retire all fields in the category
            if (fieldNos.length > 0) {
                await tx.masterFieldDefinition.updateMany({
                    where: { categoryId },
                    data: { isActive: false }
                });

                // 3. Deactivate all active source mappings targeting those fields
                await tx.sourceFieldMapping.updateMany({
                    where: { targetFieldNo: { in: fieldNos }, isActive: true },
                    data: { isActive: false }
                });
            }
            // FieldClaims and Question.masterFieldNo links are deliberately NOT touched.
            // They must remain resolvable for historical explainability.
        });

        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data");

        return { success: true, hardDeleted: false };
    } catch (e) {
        console.error("[retireMasterDataCategory] Error:", e);
        return { success: false, error: String(e) };
    }
}
