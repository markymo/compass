"use server";

import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";

export async function getMasterSchemaFields() {
    // Return canonical fields from code-base (Phase 2 Source of Truth)
    return Object.values(FIELD_DEFINITIONS).map(def => ({
        key: String(def.fieldNo),
        fieldNo: def.fieldNo,
        label: def.fieldName,
        description: def.notes || "",
        type: def.dataType
    }));
}
