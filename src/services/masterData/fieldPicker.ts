import prisma from "@/lib/prisma";

export type FieldPickerMode = "default" | "advanced";

export type FieldPickerItem =
    | {
        kind: "group";
        groupId: string;
        key: string;
        label: string;
        category: string | null;
        order: number;
        description: string | null;
    }
    | {
        kind: "field";
        fieldNo: number;
        fieldName: string;
        appDataType: string;
        category: string | null;
        order: number;
        isMultiValue: boolean;
    };

/**
 * listFieldPickerItems: Server-side logic for the field picker.
 * mode: "default" -> groups + standalone fields
 * mode: "advanced" -> groups + all fields
 */
export async function listFieldPickerItems(mode: FieldPickerMode = "default"): Promise<FieldPickerItem[]> {
    // 1. Fetch Active Groups
    const groups = await prisma.masterFieldGroup.findMany({
        where: { isActive: true },
        orderBy: [
            { category: 'asc' },
            { order: 'asc' }
        ]
    });

    // 2. Fetch Active Fields
    const fieldWhere: any = { isActive: true };

    if (mode === 'default') {
        // A field is standalone if it has no group item that hides it
        fieldWhere.groupItems = {
            none: { hideFromFieldPicker: true }
        };
    }

    const fields = await prisma.masterFieldDefinition.findMany({
        where: fieldWhere,
        orderBy: [
            { category: 'asc' },
            { order: 'asc' }
        ]
    });

    // 3. Map to Picker Items
    const items: FieldPickerItem[] = [
        ...groups.map(g => ({
            kind: 'group' as const,
            groupId: g.id,
            key: g.key,
            label: g.label,
            category: g.category,
            order: g.order,
            description: g.description
        })),
        ...fields.map(f => ({
            kind: 'field' as const,
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            appDataType: f.appDataType,
            category: f.category,
            order: f.order,
            isMultiValue: f.isMultiValue
        }))
    ];

    // 4. Final multi-level sort
    return items.sort((a, b) => {
        // Primary: Category
        const catA = a.category || 'ZZZ';
        const catB = b.category || 'ZZZ';
        if (catA !== catB) return catA.localeCompare(catB);

        // Secondary: Order
        if (a.order !== b.order) return a.order - b.order;

        // Tertiary: Label
        const labelA = a.kind === 'group' ? a.label : a.fieldName;
        const labelB = b.kind === 'group' ? b.label : b.fieldName;
        return labelA.localeCompare(labelB);
    });
}
