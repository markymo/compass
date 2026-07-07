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
        revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");
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
        defaultResponse?: string;
        description?: string;
        fmsbRef?: string;
        domain?: string[];
        isActive?: boolean;
        order?: number;
        appDataType?: string;
        isMultiValue?: boolean;
        optionSetId?: string | null;
        profileConfig?: any;
    }
) {
    try {
        let finalData: any = { ...data };
        delete finalData.newCategoryName;

        // Sanitize: empty string means "no category", which must be `null` in DB to avoid FK violation
        if (finalData.categoryId !== undefined) {
            finalData.categoryId = finalData.categoryId?.trim() || null;
        }

        if (data.newCategoryName?.trim()) {
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

        if (finalData.profileConfig?.partyPopulationPolicy === 'CURATED_ONLY') {
            const activeMappings = await (prisma as any).sourceFieldMapping.count({
                where: { targetFieldNo: fieldNo, isActive: true }
            });
            if (activeMappings > 0) {
                return { success: false, error: 'Cannot set field to Curated Only while active source mappings exist. Disable them first.' };
            }
        }

        await (prisma as any).masterFieldDefinition.update({
            where: { fieldNo },
            data: finalData
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data", "layout");

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
    defaultResponse?: string;
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
                defaultResponse: data.defaultResponse,
                fmsbRef: data.fmsbRef,
                domain: data.domain || [],
                isActive: data.isActive !== undefined ? data.isActive : true,
                order: data.order ?? 999,
                isMultiValue: data.isMultiValue || false,
                optionSetId: data.optionSetId || undefined,
            }
        });
        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");
        return { success: true };
    } catch (e) {
        console.error("[updateMasterFieldGroup] Error:", e);
        return { success: false, error: String(e) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Membership Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * addFieldToGroup: Adds a field to a group as a new MasterFieldGroupItem.
 *
 * Guards:
 *   - Group must exist and be active.
 *   - Field must exist and be active.
 *   - Field must not already be in this group (@@unique enforced at DB level too).
 *
 * The new item is appended (order = MAX(order) + 1) with hideFromFieldPicker=true by default,
 * keeping the field hidden from the standalone picker until the admin opts out.
 */
export async function addFieldToGroup(
    groupId: string,
    fieldNo: number,
    options?: { hideFromFieldPicker?: boolean }
): Promise<{ success: boolean; error?: string }> {
    try {
        const group = await (prisma as any).masterFieldGroup.findUnique({
            where: { id: groupId, isActive: true }
        });
        if (!group) return { success: false, error: 'Group not found or inactive.' };

        const field = await (prisma as any).masterFieldDefinition.findUnique({
            where: { fieldNo, isActive: true }
        });
        if (!field) return { success: false, error: `Field ${fieldNo} not found or inactive.` };

        const existing = await (prisma as any).masterFieldGroupItem.findUnique({
            where: { groupId_fieldNo: { groupId, fieldNo } }
        });
        if (existing) return { success: false, error: 'Field is already a member of this group.' };

        const maxItem = await (prisma as any).masterFieldGroupItem.findFirst({
            where: { groupId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const nextOrder = (maxItem?.order ?? -1) + 1;

        await (prisma as any).masterFieldGroupItem.create({
            data: {
                groupId,
                fieldNo,
                order: nextOrder,
                hideFromFieldPicker: options?.hideFromFieldPicker ?? true,
            }
        });

        invalidateDefinitionCache();
        revalidatePath('/app/admin/master-data', 'layout');
        return { success: true };
    } catch (e) {
        console.error('[addFieldToGroup] Error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * removeGroupItem: Removes a single MasterFieldGroupItem by its id.
 */
export async function removeGroupItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await (prisma as any).masterFieldGroupItem.delete({ where: { id: itemId } });
        invalidateDefinitionCache();
        revalidatePath('/app/admin/master-data', 'layout');
        return { success: true };
    } catch (e) {
        console.error('[removeGroupItem] Error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * reorderGroupItems: Reorders all items in a group.
 *
 * `orderedItemIds` must be the COMPLETE current set of item IDs for this group —
 * no more, no less. Any mismatch is rejected to prevent partial updates.
 * Each item is assigned order = its index in the supplied array (0-based).
 */
export async function reorderGroupItems(
    groupId: string,
    orderedItemIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const currentItems = await (prisma as any).masterFieldGroupItem.findMany({
            where: { groupId },
            select: { id: true }
        });
        const currentIds = new Set(currentItems.map((i: any) => i.id));

        if (currentItems.length !== orderedItemIds.length) {
            return {
                success: false,
                error: `Supplied ${orderedItemIds.length} item IDs but group has ${currentItems.length} items. ` +
                    `Provide the complete item list.`
            };
        }
        for (const id of orderedItemIds) {
            if (!currentIds.has(id)) {
                return { success: false, error: `Item ID "${id}" does not belong to this group.` };
            }
        }

        await (prisma as any).$transaction(
            orderedItemIds.map((id: string, i: number) =>
                (prisma as any).masterFieldGroupItem.update({ where: { id }, data: { order: i } })
            )
        );

        invalidateDefinitionCache();
        revalidatePath('/app/admin/master-data', 'layout');
        return { success: true };
    } catch (e) {
        console.error('[reorderGroupItems] Error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * toggleGroupItemPickerVisibility: Sets hideFromFieldPicker on a single group item.
 *
 * When true: the field is suppressed from the standalone field picker — it only
 * appears via its parent group.
 * When false: the field is visible both standalone and as part of its group.
 */
export async function toggleGroupItemPickerVisibility(
    itemId: string,
    hideFromFieldPicker: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        await (prisma as any).masterFieldGroupItem.update({
            where: { id: itemId },
            data: { hideFromFieldPicker }
        });
        invalidateDefinitionCache();
        revalidatePath('/app/admin/master-data', 'layout');
        return { success: true };
    } catch (e) {
        console.error('[toggleGroupItemPickerVisibility] Error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * getAvailableFieldsForGroup: Returns active fields NOT yet in this group.
 * Used by the AddFieldPopover to populate its search list.
 * Lazy-loaded (called only when the popover opens).
 */
export async function getAvailableFieldsForGroup(
    groupId: string
): Promise<{ success: boolean; fields?: { fieldNo: number; fieldName: string; appDataType: string }[]; error?: string }> {
    try {
        const existingItems = await (prisma as any).masterFieldGroupItem.findMany({
            where: { groupId },
            select: { fieldNo: true }
        });
        const existingFieldNos: number[] = existingItems.map((i: any) => i.fieldNo);

        const fields = await (prisma as any).masterFieldDefinition.findMany({
            where: {
                isActive: true,
                fieldNo: existingFieldNos.length > 0 ? { notIn: existingFieldNos } : undefined
            },
            select: { fieldNo: true, fieldName: true, appDataType: true },
            orderBy: [{ order: 'asc' }, { fieldNo: 'asc' }]
        });

        return { success: true, fields };
    } catch (e) {
        console.error('[getAvailableFieldsForGroup] Error:', e);
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

        revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");

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
            revalidatePath("/app/admin/master-data", "layout");
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
        revalidatePath("/app/admin/master-data", "layout");

        return { success: true, hardDeleted: false };
    } catch (e) {
        console.error("[retireMasterDataCategory] Error:", e);
        return { success: false, error: String(e) };
    }
}

export interface DependencyReport {
    canDelete: boolean;
    dependencies: {
        referenceQuestionnaires: number;
        workingQuestionnaires: number;
        engagementQuestionnaires: number;
        clientProfilesWithData: number;
        fiSchemaOverlays: number;
    }
}

export async function checkCustomFieldDependencies(fieldId: string): Promise<DependencyReport> {
    const questions = await prisma.question.findMany({
        where: { customFieldDefinitionId: fieldId },
        include: { 
            questionnaire: {
                include: {
                    fiEngagement: true
                }
            }
        }
    });

    let referenceQuestionnaires = 0;
    let workingQuestionnaires = 0;
    let engagementQuestionnaires = 0;

    for (const q of questions) {
        if (q.questionnaire.isDeleted) continue;

        if (q.questionnaire.isTemplate) {
            referenceQuestionnaires++;
        } else if (q.questionnaire.fiEngagementId) {
            if (q.questionnaire.fiEngagement?.isDeleted) continue;
            engagementQuestionnaires++;
        } else {
            workingQuestionnaires++;
        }
    }

    // JSONB check for ClientLE
    const leRes = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM "ClientLE" WHERE "customData"::jsonb ? ${fieldId}`;
    const clientProfilesWithData = Number(leRes[0].count);

    // Conservative check for FISchema (JSON LIKE search as we don't know the exact structure it might be buried in)
    const schemaRes = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM "FISchema" WHERE "overlayDefinition"::text LIKE ${'%' + fieldId + '%'}`;
    const fiSchemaOverlays = Number(schemaRes[0].count);

    const hasDependencies = (referenceQuestionnaires + workingQuestionnaires + engagementQuestionnaires + clientProfilesWithData + fiSchemaOverlays) > 0;

    return {
        canDelete: !hasDependencies,
        dependencies: {
            referenceQuestionnaires,
            workingQuestionnaires,
            engagementQuestionnaires,
            clientProfilesWithData,
            fiSchemaOverlays
        }
    };
}

export async function softDeleteCustomField(fieldId: string) {
    const check = await checkCustomFieldDependencies(fieldId);
    if (!check.canDelete) {
        return { success: false, error: "Cannot delete field with active dependencies" };
    }

    const field = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
    if (!field) return { success: false, error: "Field not found" };

    try {
        await prisma.customFieldDefinition.update({
            where: { id: fieldId },
            data: {
                isDeleted: true,
                key: `${field.key}__deleted__${fieldId}`
            }
        });
        revalidatePath("/app/admin/master-data", "layout");
        return { success: true };
    } catch (e) {
        console.error("[softDeleteCustomField] Error:", e);
        return { success: false, error: "Failed to delete custom field" };
    }
}
