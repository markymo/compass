import prisma from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Loads categories and active fields for Master Record view (/app/le/[id]/master) and admin sorting.
 * Note: Only active categories and uncategorized active fields (categoryId: null) are returned here.
 */
export async function getCategoriesWithFields(client: DbClient = prisma) {
    const categories = await (client as any).masterDataCategory.findMany({
        where: { isActive: true },
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

    const uncategorizedFields = await (client as any).masterFieldDefinition.findMany({
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
        customFields: [],
        categories,
        uncategorizedFields
    };
}

/**
 * Flattens categories and uncategorized fields in the exact display sequence of the Master Record (/app/le/[id]/master).
 */
export async function getMasterRecordOrderedFields(client: DbClient = prisma): Promise<Array<{ fieldNo: number; fieldName: string }>> {
    const { categories, uncategorizedFields } = await getCategoriesWithFields(client);
    return [
        ...categories.flatMap((c: any) => c.fields),
        ...uncategorizedFields
    ];
}

/**
 * Loads all active Master Fields in canonical Superset order:
 * 1. Prefix: Master Record ordered fields (exact canonical Master Record sequence)
 * 2. Suffix: Any residual active fields not returned by the Master Record loader
 *    (e.g., active fields attached to inactive categories), sorted deterministically by { order: 'asc' }, { fieldNo: 'asc' }.
 */
export async function getSupersetOrderedMasterFields(client: DbClient = prisma): Promise<Array<{ fieldNo: number; fieldName: string }>> {
    const masterRecordFields = await getMasterRecordOrderedFields(client);
    const seenFieldNos = new Set(masterRecordFields.map(f => f.fieldNo));

    const residualActiveFields = await (client as any).masterFieldDefinition.findMany({
        where: {
            isActive: true,
            fieldNo: { notIn: Array.from(seenFieldNos) }
        },
        orderBy: [
            { order: 'asc' },
            { fieldNo: 'asc' }
        ],
        select: {
            fieldNo: true,
            fieldName: true
        }
    });

    return [
        ...masterRecordFields,
        ...residualActiveFields
    ];
}
