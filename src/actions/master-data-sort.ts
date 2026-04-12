"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateDefinitionCache } from "@/services/masterData/definitionService";


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

