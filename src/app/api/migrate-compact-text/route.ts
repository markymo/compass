/**
 * API route to run the compactText migration
 * Call this once to populate existing questions with compactText from extractedContent
 */

import { NextResponse } from "next/server";
import { migrateCompactText } from "@/actions/migrate-compact-text";
import { isSystemAdmin } from "@/actions/security";

export async function POST() {
    // Security check
    if (!(await isSystemAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await migrateCompactText();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Migration failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
