"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/security";
import { revalidatePath } from "next/cache";

export type SharingState = "PRIVATE" | "RESTRICTED" | "GLOBAL";

export interface QV2Row {
    id: string;
    name: string;
    kind: "working-copy" | "reference";
    status: string;
    fiOrgName: string | null;
    ownerOrgName: string | null;
    questionCount: number;
    updatedAt: Date;
    createdAt: Date;
    hasFile: boolean;
    basedOn: string | null;
    sourceId: string | null;
    sharingState: SharingState | null; // null for working copies
}

// ── Shared clone helper ─────────────────────────────────────────────────────

function cloneQuestions(questions: any[], targetId: string) {
    return questions.map((q: any) => ({
        questionnaireId: targetId,
        text: q.text,
        compactText: q.compactText,
        order: q.order,
        masterFieldNo: q.masterFieldNo,
        masterQuestionGroupId: q.masterQuestionGroupId,
        customFieldDefinitionId: q.customFieldDefinitionId,
        sourceSectionId: q.sourceSectionId,
        expectedDataType: q.expectedDataType,
        allowAttachments: q.allowAttachments,
        prefilledValue: q.prefilledValue,
        status: "DRAFT",
    }));
}

function deepCopyJson(val: any) {
    return val ? JSON.parse(JSON.stringify(val)) : undefined;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getQuestionnairesV2(): Promise<{
    workingCopies: QV2Row[];
    referenceLibrary: QV2Row[];
}> {
    if (!await isSystemAdmin()) return { workingCopies: [], referenceLibrary: [] };

    const rows = await prisma.questionnaire.findMany({
        where: { isDeleted: false, isTemplate: true },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            name: true,
            status: true,
            isGlobal: true,
            updatedAt: true,
            createdAt: true,
            fileName: true,
            fileUrl: true,
            processingLogs: true,
            fiOrg: { select: { name: true } },
            ownerOrg: { select: { name: true } },
            _count: { select: { questions: true } },
        },
    });

    const mapped: QV2Row[] = rows.map((r: any) => {
        const refMeta = (r.processingLogs as any)?._ref;
        const isRef = r.isGlobal;
        return {
            id: r.id,
            name: r.name,
            kind: isRef ? "reference" : "working-copy",
            status: r.status,
            fiOrgName: r.fiOrg?.name ?? null,
            ownerOrgName: r.ownerOrg?.name ?? null,
            questionCount: r._count.questions,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
            hasFile: !!(r.fileName || r.fileUrl),
            basedOn: refMeta?.sourceName ?? null,
            sourceId: refMeta?.sourceId ?? null,
            // Working copies created from references carry _ref too — they are still "working-copy" kind
            sharingState: isRef
                ? (refMeta?.sharingState as SharingState | undefined) ?? "PRIVATE"
                : null,
        };
    });

    return {
        workingCopies:    mapped.filter(r => r.kind === "working-copy"),
        referenceLibrary: mapped.filter(r => r.kind === "reference"),
    };
}

// ── Add to Reference Library ────────────────────────────────────────────────
// Creates a new read-only reference from a working copy.
// Source working copy is never mutated.

export async function addToReferenceLibrary(
    workingCopyId: string,
): Promise<{ success: boolean; referenceId?: string; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: workingCopyId, isDeleted: false },
        include: { questions: true },
    });

    if (!source) return { success: false, error: "Working copy not found" };
    if (source.isGlobal) return { success: false, error: "Already in Reference Library" };

    try {
        const reference = await prisma.questionnaire.create({
            data: {
                fiOrgId: source.fiOrgId,
                ownerOrgId: source.ownerOrgId ?? undefined,
                name: source.name,
                status: "ACTIVE",
                isTemplate: true,
                isGlobal: true,
                fileUrl: source.fileUrl ?? undefined,
                fileName: source.fileName ?? undefined,
                fileType: source.fileType ?? undefined,
                extractedContent: deepCopyJson(source.extractedContent),
                mappings: deepCopyJson(source.mappings),
                processingLogs: {
                    _ref: {
                        sourceId: source.id,
                        sourceName: source.name,
                        sharingState: "PRIVATE" as SharingState,
                        addedAt: new Date().toISOString(),
                    },
                },
            },
        });

        if ((source.questions as any[]).length > 0) {
            await prisma.question.createMany({
                data: cloneQuestions(source.questions as any[], reference.id),
            });
        }

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true, referenceId: reference.id };
    } catch (e: any) {
        console.error("[addToReferenceLibrary]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

// ── Create Working Copy ─────────────────────────────────────────────────────
// Creates a new editable working copy from a reference library item.
// Source reference is never mutated.

export async function createWorkingCopy(
    referenceId: string,
): Promise<{ success: boolean; workingCopyId?: string; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: referenceId, isDeleted: false, isGlobal: true },
        include: { questions: true },
    });

    if (!source) return { success: false, error: "Reference not found" };

    try {
        const wc = await prisma.questionnaire.create({
            data: {
                fiOrgId: source.fiOrgId,
                ownerOrgId: source.ownerOrgId ?? undefined,
                name: source.name,
                status: "DRAFT",
                isTemplate: true,
                isGlobal: false,
                fileUrl: source.fileUrl ?? undefined,
                fileName: source.fileName ?? undefined,
                fileType: source.fileType ?? undefined,
                extractedContent: deepCopyJson(source.extractedContent),
                mappings: deepCopyJson(source.mappings),
                processingLogs: {
                    _ref: {
                        sourceId: referenceId,
                        sourceName: source.name,
                        derivedAt: new Date().toISOString(),
                    },
                },
            },
        });

        if ((source.questions as any[]).length > 0) {
            await prisma.question.createMany({
                data: cloneQuestions(source.questions as any[], wc.id),
            });
        }

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true, workingCopyId: wc.id };
    } catch (e: any) {
        console.error("[createWorkingCopy]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

// ── Update Sharing State ────────────────────────────────────────────────────

export async function updateSharingState(
    referenceId: string,
    state: SharingState,
): Promise<{ success: boolean; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: referenceId, isDeleted: false, isGlobal: true },
        select: { processingLogs: true },
    });

    if (!source) return { success: false, error: "Reference not found" };

    const existing = (source.processingLogs as any) ?? {};
    const existingRef = existing._ref ?? {};

    try {
        await prisma.questionnaire.update({
            where: { id: referenceId },
            data: {
                processingLogs: {
                    ...existing,
                    _ref: {
                        ...existingRef,
                        sharingState: state,
                        sharingUpdatedAt: new Date().toISOString(),
                    },
                },
            },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[updateSharingState]", e);
        return { success: false, error: e.message || "Failed" };
    }
}
