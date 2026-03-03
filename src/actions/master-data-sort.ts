"use server";

import prisma from "@/lib/prisma";

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

    const distinctCategoryNames = Array.from(new Set(fields.map(f => f.category!.trim()).filter(Boolean)));

    const normalize = (name: string) => {
        return name.trim().toLowerCase().replace(/[\s\W]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    };

    const categoriesToCreate: { name: string; key: string; order: number }[] = [];
    const usedKeys = new Set<string>();

    for (let i = 0; i < distinctCategoryNames.length; i++) {
        const name = distinctCategoryNames[i];
        let baseKey = normalize(name);
        if (!baseKey) continue;

        let key = baseKey;
        let suffix = 2;
        while (usedKeys.has(key)) {
            key = `${baseKey}-${suffix}`;
            suffix++;
        }
        usedKeys.add(key);

        categoriesToCreate.push({
            name,
            key,
            order: i
        });
    }

    await prisma.$transaction(async (tx) => {
        for (const cat of categoriesToCreate) {
            await tx.masterDataCategory.upsert({
                where: { key: cat.key },
                update: { displayName: cat.name },
                create: { key: cat.key, displayName: cat.name, order: cat.order }
            });
        }

        const allCategories = await tx.masterDataCategory.findMany();
        const categoryMap = new Map(allCategories.map(c => [c.displayName.toLowerCase().trim(), c]));

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
        payload.map(item =>
            prisma.masterDataCategory.update({
                where: { id: item.id },
                data: { order: item.order }
            })
        )
    );
    return { success: true };
}

export async function updateFieldOrder(payload: { fieldNo: number; order: number }[]) {
    await prisma.$transaction(
        payload.map(item =>
            prisma.masterFieldDefinition.update({
                where: { fieldNo: item.fieldNo },
                data: { order: item.order }
            })
        )
    );
    return { success: true };
}
