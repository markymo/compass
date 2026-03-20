"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateDefinitionCache } from "@/services/masterData/definitionService";

export async function syncCategoriesFromFields() {
    const fields = await prisma.masterFieldDefinition.findMany({
        where: {
            category: { not: null }
        },
        select: {
            fieldNo: true,
            category: true,
            categoryId: true
        }
    });

    const distinctCategoryNames = Array.from(new Set(fields.map((f: any) => f.category!.trim()).filter(Boolean)));

    const normalize = (name: string) => {
        return name.trim().toLowerCase().replace(/[\s\W]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    };

    const categoriesToCreate: { name: string; key: string; order: number }[] = [];
    const usedKeys = new Set<string>();

    for (let i = 0; i < distinctCategoryNames.length; i++) {
        const name = distinctCategoryNames[i];
        let baseKey = normalize(name as string);
        if (!baseKey) continue;

        let key = baseKey;
        let suffix = 2;
        while (usedKeys.has(key)) {
            key = `${baseKey}-${suffix}`;
            suffix++;
        }
        usedKeys.add(key);

        categoriesToCreate.push({
            name: name as string,
            key,
            order: i
        });
    }

    await prisma.$transaction(async (tx: any) => {
        for (const cat of categoriesToCreate) {
            await tx.masterDataCategory.upsert({
                where: { key: cat.key },
                update: { displayName: cat.name },
                create: { key: cat.key, displayName: cat.name, order: cat.order }
            });
        }

        const allCategories = await tx.masterDataCategory.findMany();
        const categoryMap = new Map<string, any>(allCategories.map((c: any) => [c.displayName.toLowerCase().trim(), c]));

        for (const field of fields) {
            const name = field.category!.trim();
            const categoryMatch = categoryMap.get(name.toLowerCase());
            if (categoryMatch) {
                await tx.masterFieldDefinition.update({
                    where: { fieldNo: field.fieldNo },
                    data: {
                        categoryId: categoryMatch.id,
                        categoryLabel: categoryMatch.displayName
                    }
                });
            }
        }
    });

    return { success: true };
}

export async function getCategoriesWithFields() {
    const categories = await prisma.masterDataCategory.findMany({
        orderBy: [
            { order: 'asc' },
            { displayName: 'asc' }
        ],
        include: {
            fields: {
                orderBy: [
                    { order: 'asc' },
                    { fieldNo: 'asc' }
                ],
                where: {
                    isActive: true
                }
            }
        }
    });

    const uncategorizedFields = await prisma.masterFieldDefinition.findMany({
        where: {
            categoryId: null,
            isActive: true
        },
        orderBy: [
            { order: 'asc' },
            { fieldNo: 'asc' }
        ]
    });

    return {
        customFields: [], // Client UI will likely inject org-specific custom fields, but this handles system master data
        categories,
        uncategorizedFields
    };
}

export async function updateCategoryOrder(payload: { id: string; order: number }[]) {
    await prisma.$transaction(
        payload.map((item: any) =>
            prisma.masterDataCategory.update({
                where: { id: item.id },
                data: { order: item.order }
            })
        )
    );
    return { success: true };
}

export async function updateFieldOrder(payload: { fieldNo: number; order: number; categoryId?: string | null }[]) {
    await prisma.$transaction(
        payload.map((item: any) =>
            prisma.masterFieldDefinition.update({
                where: { fieldNo: item.fieldNo },
                data: { 
                    order: item.order,
                    ...(item.categoryId !== undefined ? { categoryId: item.categoryId } : {})
                }
            })
        )
    );
    return { success: true };
}

/**
 * moveFieldOrder: Swaps a field's order with its adjacent sibling within the same category.
 */
export async function moveFieldOrder(fieldNo: number, direction: "up" | "down") {
    try {
        const target = await prisma.masterFieldDefinition.findUnique({ where: { fieldNo } });
        if (!target) return { success: false, error: "Field not found" };

        // Fetch all fields in the same category, sorted by order
        const siblings = await prisma.masterFieldDefinition.findMany({
            where: {
                categoryId: target.categoryId ?? null,
                isActive: true,
            },
            orderBy: [
                { order: "asc" },
                { fieldNo: "asc" },
            ],
            select: { fieldNo: true, order: true },
        });

        const idx = siblings.findIndex((f: { fieldNo: number }) => f.fieldNo === fieldNo);
        if (idx === -1) return { success: false, error: "Field not in sibling list" };

        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= siblings.length) {
            return { success: false, error: "Already at boundary" };
        }

        const sibling = siblings[swapIdx];

        // Swap order values
        await prisma.$transaction([
            prisma.masterFieldDefinition.update({
                where: { fieldNo: target.fieldNo },
                data: { order: sibling.order },
            }),
            prisma.masterFieldDefinition.update({
                where: { fieldNo: sibling.fieldNo },
                data: { order: target.order },
            }),
        ]);

        invalidateDefinitionCache();
        revalidatePath("/app/admin/master-data");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e) {
        console.error("[moveFieldOrder] Error:", e);
        return { success: false, error: String(e) };
    }
}

