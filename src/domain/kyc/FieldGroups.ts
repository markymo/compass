import { FIELD_DEFINITIONS } from "./FieldDefinitions";

export type FieldGroup = {
    id: string;
    label: string;
    fieldNos: number[];
    description?: string;
    repeatable?: boolean;
};

export const FIELD_GROUPS: Record<string, FieldGroup> = {
    REGISTERED_ADDRESS: {
        id: 'REGISTERED_ADDRESS',
        label: 'Registered Address',
        fieldNos: [6, 7, 8, 9, 10], // Line 1, City, Region, Country, Postcode
        description: "The official registered address of the entity."
    },
    HEADQUARTERS_ADDRESS: {
        id: 'HEADQUARTERS_ADDRESS',
        label: 'Headquarters Address',
        fieldNos: [11, 12, 13, 14, 15], // Line 1, City, Region, Country, Postcode
        description: "The primary business address or headquarters."
    },
    // Example of a repeatable group (though implementation of repeatable UI is a later step)
    // TRADING_AUTH_PERSON: {
    //     id: 'TRADING_AUTH_PERSON',
    //     label: 'Authorised Trader',
    //     fieldNos: [96, 97, 98, 99, 100, 101],
    //     repeatable: true,
    // }
};

// --- Validation Guardrail ---
// This ensures that we never define a FieldGroup with "magic numbers" that don't exist.
// This block runs eagerly when the module is loaded.
(function validateFieldGroups() {
    for (const groupKey of Object.keys(FIELD_GROUPS)) {
        const group = FIELD_GROUPS[groupKey];
        for (const fieldNo of group.fieldNos) {
            if (!FIELD_DEFINITIONS[fieldNo]) {
                throw new Error(
                    `Configuration Error: FieldGroup '${group.id}' references non-existent FieldNo ${fieldNo}. ` +
                    `Please check FieldDefinitions.ts.`
                );
            }
        }
    }
})();

export function getFieldGroup(id: string): FieldGroup | undefined {
    return FIELD_GROUPS[id];
}

export function getAllFieldGroups(): FieldGroup[] {
    return Object.values(FIELD_GROUPS);
}
