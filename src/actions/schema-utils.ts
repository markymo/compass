"use server";

import prisma from "@/lib/prisma";

export async function getMasterSchemaFields() {
    // Return canonical fields from database (Dynamic Source of Truth)
    const fields = await (prisma as any).masterFieldDefinition.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
    });

    return fields.map((def: any) => ({
        key: String(def.fieldNo),
        fieldNo: def.fieldNo,
        label: def.fieldName,
        description: def.notes || "",
        type: def.appDataType
    }));
}
