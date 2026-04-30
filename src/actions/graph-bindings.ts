"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GraphBindingInput {
    id?: string;
    fieldNo: number;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
    writeBackEdgeType?: string | null;
    writeBackIsActive?: boolean;
    pickerLabel?: string | null;
    allowCreate?: boolean;
    isActive?: boolean;
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getGraphBindingsForField(fieldNo: number) {
    try {
        const bindings = await prisma.masterFieldGraphBinding.findMany({
            where: { fieldNo },
            orderBy: { createdAt: "asc" },
        });
        return { success: true, bindings };
    } catch (e: any) {
        return { success: false, error: String(e), bindings: [] };
    }
}

// ── Write ──────────────────────────────────────────────────────────────────

export async function upsertGraphBinding(input: GraphBindingInput) {
    // Guard: detect stale Prisma client (happens when dev server hasn't been restarted
    // after prisma db push added the masterFieldGraphBinding table)
    if (!(prisma as any).masterFieldGraphBinding) {
        return {
            success: false,
            error: "Prisma client is stale — please restart the dev server (npm run dev) to load the new schema.",
        };
    }

    try {
        const data = {
            fieldNo: input.fieldNo,
            graphNodeType: input.graphNodeType,
            filterEdgeType: input.filterEdgeType ?? null,
            filterActiveOnly: input.filterActiveOnly ?? true,
            writeBackEdgeType: input.writeBackEdgeType ?? null,
            writeBackIsActive: input.writeBackIsActive ?? true,
            pickerLabel: input.pickerLabel ?? null,
            allowCreate: input.allowCreate ?? true,
            isActive: input.isActive ?? true,
        };

        let binding;
        if (input.id) {
            binding = await (prisma as any).masterFieldGraphBinding.update({
                where: { id: input.id },
                data,
            });
        } else {
            binding = await (prisma as any).masterFieldGraphBinding.create({ data });
        }

        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true, binding };
    } catch (e: any) {
        console.error("[upsertGraphBinding]", e);
        return { success: false, error: String(e) };
    }
}


export async function deleteGraphBinding(id: string) {
    try {
        await prisma.masterFieldGraphBinding.delete({ where: { id } });
        revalidatePath("/app/admin/master-data/manager");
        revalidatePath("/app/admin/master-data/fields");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
}

// ── Query helper used by the Graph Explorer ────────────────────────────────

/**
 * Returns all active graph bindings grouped by writeBackEdgeType.
 * Used by the Graph Explorer page to dynamically resolve which edge types
 * correspond to which master fields — replacing all hardcoded fieldNo === 63 checks.
 */
export async function getActiveGraphBindingsByEdgeType(): Promise<
    Record<string, { fieldNos: number[]; graphNodeType: string; filterActiveOnly: boolean }>
> {
    const bindings = await prisma.masterFieldGraphBinding.findMany({
        where: { isActive: true, writeBackEdgeType: { not: null } },
        select: {
            fieldNo: true,
            graphNodeType: true,
            writeBackEdgeType: true,
            filterActiveOnly: true,
        },
    });

    const grouped: Record<string, { fieldNos: number[]; graphNodeType: string; filterActiveOnly: boolean }> = {};
    for (const b of bindings) {
        const key = b.writeBackEdgeType!;
        if (!grouped[key]) {
            grouped[key] = { fieldNos: [], graphNodeType: b.graphNodeType, filterActiveOnly: b.filterActiveOnly };
        }
        grouped[key].fieldNos.push(b.fieldNo);
    }
    return grouped;
}
