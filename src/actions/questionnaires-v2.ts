"use server";

import prisma from "@/lib/prisma";

import { 
    normalizeCode, 
    generateReferenceCodePrefix, 
    computeNextVersion,
    formatYYMMDD
} from "@/lib/questionnaires/reference-codes";
import { bootstrapSystemOrg } from "./admin";
import { isSystemAdmin } from "@/actions/security";
import { revalidatePath } from "next/cache";

import { QuestionnaireVisibility } from "@prisma/client";

/** @deprecated Use QuestionnaireVisibility from @prisma/client directly. */
export type SharingState = "PRIVATE" | "RESTRICTED" | "GLOBAL";

export interface QV2Row {
    id: string;
    name: string;
    kind: "WORKING_COPY" | "REFERENCE_SNAPSHOT" | "ENGAGEMENT_QUESTIONNAIRE" | null;
    functionalCode: string | null;
    referenceCode: string | null;
    isOnProOwned: boolean;
    status: string;
    fiOrgName: string | null;
    ownerOrgName: string | null;
    clientLeName: string | null;
    clientLeShortCode: string | null;
    supplierName: string | null;
    supplierShortCode: string | null;
    questionCount: number;
    /** How many questionnaires have sourceId = this.id (including deleted/archived). */
    descendantCount: number;
    updatedAt: Date;
    createdAt: Date;
    hasFile: boolean;
    basedOn: string | null;
    sourceId: string | null;
    /** Visibility of this Reference Snapshot. Null for Working Copies and Engagement Questionnaires. */
    visibility: QuestionnaireVisibility | null;
    /** @deprecated kept for backwards compat; same value as visibility. */
    sharingState: SharingState | null;
}

// ── Shared clone helper ─────────────────────────────────────────────────────

import { cloneQuestionFields } from "@/lib/questionnaires/question-utils";

function cloneQuestions(questions: any[], targetId: string) {
    return questions.map((q: any) => cloneQuestionFields(q, targetId));
}

function deepCopyJson(val: any) {
    return val ? JSON.parse(JSON.stringify(val)) : undefined;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getQuestionnairesV2(): Promise<{
    workingCopies: QV2Row[];
    referenceLibrary: QV2Row[];
    other: QV2Row[];
}> {
    if (!await isSystemAdmin()) return { workingCopies: [], referenceLibrary: [], other: [] };


    const rows = await prisma.questionnaire.findMany({
        // Exclude hard-deleted and archived rows from the live list.
        // Archived items are hidden from normal views (status = ARCHIVED).
        where: { isDeleted: false, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            name: true,
            status: true,
            isGlobal: true,
            isTemplate: true,
            kind: true,
            functionalCode: true,
            referenceCode: true,
            sourceId: true, // lineage column
            visibility: true, // first-class visibility
            updatedAt: true,
            createdAt: true,
            fileName: true,
            processingLogs: true,
            fiOrg: { select: { name: true } },
            ownerOrgId: true,
            ownerOrg: { select: { name: true, types: true } },
            fiEngagement: {
                select: {
                    clientLE: { select: { name: true, shortCode: true } },
                    org: { select: { name: true, shortCode: true } }
                }
            },
            // descendantCount: count ALL children regardless of their deleted/archived state.
            // This makes lineage permanent — once a child existed, the parent is forever "used".
            _count: { select: { questions: true, derivedVersions: true } },
        },
    });

    const mapped: QV2Row[] = rows.map((r: any) => {
        const refMeta = (r.processingLogs as any)?._ref;
        
        // Fallback for pre-migration data
        let kind = r.kind;
        if (!kind) {
            if (r.isTemplate) {
                kind = r.isGlobal ? "REFERENCE_SNAPSHOT" : "WORKING_COPY";
            } else {
                kind = "ENGAGEMENT_QUESTIONNAIRE";
            }
        }

        // isOnProOwned = true when:
        // 1. isGlobal = true (system-level templates / forms)
        // 2. OR ownerOrgId is the host FI (the platform owner)
        
        const isOnProOwned =
            (r.ownerOrg?.types?.includes('SYSTEM') ?? false) ||
            (r.ownerOrgId === null && r.isTemplate === true);

        return {
            id: r.id,
            name: r.name,
            kind,
            functionalCode: r.functionalCode,
            referenceCode: r.referenceCode,
            isOnProOwned,
            status: r.status,
            fiOrgName: r.fiOrg?.name ?? null,
            ownerOrgName: r.ownerOrg?.name ?? null,
            clientLeName: r.fiEngagement?.clientLE?.name ?? null,
            clientLeShortCode: r.fiEngagement?.clientLE?.shortCode ?? null,
            supplierName: r.fiEngagement?.org?.name ?? null,
            supplierShortCode: r.fiEngagement?.org?.shortCode ?? null,
            questionCount: r._count.questions,
            descendantCount: r._count.derivedVersions,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
            hasFile: !!(r.fileName || r.fileUrl),
            basedOn: refMeta?.sourceName ?? null,
            // Read sourceId from the real DB column; fall back to processingLogs._ref for pre-migration records
            sourceId: r.sourceId ?? refMeta?.sourceId ?? null,
            // Visibility: use the real DB column. Only meaningful for REFERENCE_SNAPSHOT.
            visibility: kind === "REFERENCE_SNAPSHOT" ? (r.visibility ?? "PRIVATE") : null,
            // sharingState: deprecated alias kept for backwards compat
            sharingState: kind === "REFERENCE_SNAPSHOT" ? (r.visibility ?? "PRIVATE") as SharingState : null,
        };
    });

    return {
        workingCopies:    mapped.filter(r => r.kind === "WORKING_COPY" && r.isOnProOwned),
        referenceLibrary: mapped.filter(r => r.kind === "REFERENCE_SNAPSHOT" && r.isOnProOwned),
        other:            mapped.filter(r => !(r.kind === "WORKING_COPY" && r.isOnProOwned) && !(r.kind === "REFERENCE_SNAPSHOT" && r.isOnProOwned)),
    };
}

// ── Reference Library Discovery ─────────────────────────────────────────────
//
// Visibility-enforcement query for non-admin consumers.
// Only Reference Snapshots participate in discovery.
// Working Copies and Engagement Questionnaires are never exposed here.
//
// Rules:
//   PRIVATE    → owner org only  (ownerOrgId = callerOrgId)
//   GLOBAL     → all callers
//   RESTRICTED → treated as PRIVATE until grant management is implemented
//                (i.e. owner org only; no QuestionnaireVisibilityGrant join yet)
//
// No isSystemAdmin check here — callers must authenticate before calling this.

export interface DiscoverableSnapshot {
    id: string;
    name: string;
    description: string | null;
    functionalCode: string | null;
    referenceCode: string | null;
    visibility: QuestionnaireVisibility;
    ownerOrgId: string | null;
    ownerOrgName: string | null;
    questionCount: number;
    updatedAt: Date;
    createdAt: Date;
}

export async function getDiscoverableReferenceSnapshotsForOrg(
    callerOrgId: string,
): Promise<DiscoverableSnapshot[]> {
    if (!callerOrgId) return [];

    const rows = await prisma.questionnaire.findMany({
        where: {
            isDeleted: false,
            status: { not: "ARCHIVED" },
            kind: "REFERENCE_SNAPSHOT",
            // Visibility filter:
            //   GLOBAL  → always visible
            //   PRIVATE → only owner
            //   RESTRICTED → same as PRIVATE for now (no grant join)
            OR: [
                // GLOBAL: visible to all
                { visibility: "GLOBAL" },
                // PRIVATE or RESTRICTED: visible only to owner
                {
                    visibility: { in: ["PRIVATE", "RESTRICTED"] },
                    ownerOrgId: callerOrgId,
                },
            ],
        },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            name: true,
            description: true,
            functionalCode: true,
            referenceCode: true,
            visibility: true,
            ownerOrgId: true,
            ownerOrg: { select: { name: true } },
            _count: { select: { questions: true } },
            updatedAt: true,
            createdAt: true,
        },
    });

    return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        functionalCode: r.functionalCode,
        referenceCode: r.referenceCode,
        visibility: r.visibility as QuestionnaireVisibility,
        ownerOrgId: r.ownerOrgId,
        ownerOrgName: r.ownerOrg?.name ?? null,
        questionCount: r._count.questions,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
    }));
}

// ── Visibility pre-flight guard ─────────────────────────────────────────────
//
// Answers: can organisation `orgId` discover Reference Snapshot `questionnaireId`?
//
// Rules mirror getDiscoverableReferenceSnapshotsForOrg exactly:
//   GLOBAL     → yes for all orgs
//   PRIVATE    → yes only if ownerOrgId = orgId
//   RESTRICTED → yes only if ownerOrgId = orgId (no grant table checked yet)
//
// Returns false if the row does not exist, is deleted, is archived,
// or is not a REFERENCE_SNAPSHOT.
//
// Callers: assignQuestionnaireToEngagement (both implementations) before cloning.

export async function canOrgDiscoverReferenceSnapshot(
    orgId: string,
    questionnaireId: string,
): Promise<boolean> {
    if (!orgId || !questionnaireId) return false;

    const row = await prisma.questionnaire.findFirst({
        where: {
            id: questionnaireId,
            isDeleted: false,
            status: { not: "ARCHIVED" },
            kind: "REFERENCE_SNAPSHOT",
            OR: [
                { visibility: "GLOBAL" },
                {
                    visibility: { in: ["PRIVATE", "RESTRICTED"] },
                    ownerOrgId: orgId,
                },
            ],
        },
        select: { id: true },
    });

    return row !== null;
}

// ── Add to Reference Library ────────────────────────────────────────────────
// Creates a new read-only reference from a working copy.
// Source working copy is never mutated.


// Shared helper: derive the stable prefix + next version for a working copy, without writing to DB.
async function computePublishPreview(workingCopyId: string) {
    const source = await prisma.questionnaire.findUnique({
        where: { id: workingCopyId, isDeleted: false },
        select: { id: true, name: true, functionalCode: true, ownerOrgId: true },
    });
    if (!source) return null;

    const sysOrg = await bootstrapSystemOrg();
    const isSystemQuestionnaire = source.ownerOrgId === sysOrg.id;

    let functionalCode = source.functionalCode;
    if (!functionalCode) {
        if (source.name.includes("_UNPUBLISHED_")) {
            functionalCode = source.name.split("_UNPUBLISHED_")[0];
        } else {
            functionalCode = normalizeCode(source.name).slice(0, 10) || "GENERIC";
        }
    }

    const publishDate = new Date();
    const prefix = generateReferenceCodePrefix({
        functionalCode,
        clientLeShortCode: null,
        supplierShortCode: null,
        isSystemQuestionnaire,
        date: publishDate,
    });

    const existing = await prisma.questionnaire.findMany({
        where: { kind: "REFERENCE_SNAPSHOT", referenceCode: { startsWith: `${prefix}_v` } },
        select: { referenceCode: true },
    });
    const existingCodes = existing.map((q: any) => q.referenceCode).filter(Boolean) as string[];
    const nextVersion = computeNextVersion(prefix, existingCodes);
    const proposedReferenceCode = `${prefix}_v${nextVersion}`;
    const proposedSnapshotName = source.name.includes("_UNPUBLISHED_")
        ? source.name.replace("_UNPUBLISHED_", `_${formatYYMMDD(publishDate)}_`) + `_v${nextVersion}`
        : source.name;

    return {
        sourceName: source.name,
        proposedReferenceCode,
        proposedSnapshotName,
        nextVersion,
        publishDateToken: formatYYMMDD(publishDate),
    };
}

export async function previewPublishReferenceSnapshot(
    workingCopyId: string,
): Promise<{ success: boolean; preview?: { sourceName: string; proposedReferenceCode: string; proposedSnapshotName: string; nextVersion: number; publishDateToken: string }; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };
    try {
        const preview = await computePublishPreview(workingCopyId);
        if (!preview) return { success: false, error: "Working copy not found" };
        return { success: true, preview };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to compute preview" };
    }
}

export async function addToReferenceLibrary(
    workingCopyId: string,
): Promise<{ success: boolean; referenceId?: string; snapshotName?: string; snapshotReferenceCode?: string; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: workingCopyId, isDeleted: false },
        include: { questions: true },
    });

    if (!source) return { success: false, error: "Working copy not found" };
    if (source.isGlobal) return { success: false, error: "Already in Reference Library" };

    try {
        const sysOrg = await bootstrapSystemOrg();
        const isSystemQuestionnaire = source.ownerOrgId === sysOrg.id;
        
        // Ensure functionalCode falls back safely if missing and doesn't leak UNPUBLISHED
        let functionalCode = source.functionalCode;
        if (!functionalCode) {
            if (source.name.includes("_UNPUBLISHED_")) {
                functionalCode = source.name.split("_UNPUBLISHED_")[0];
            } else {
                functionalCode = normalizeCode(source.name).slice(0, 10) || "GENERIC";
            }
        }

        const prefix = generateReferenceCodePrefix({
            functionalCode,
            clientLeShortCode: null, // Snapshots are global
            supplierShortCode: null, // Snapshots are global
            isSystemQuestionnaire,
        });

        const existing = await prisma.questionnaire.findMany({
            where: { 
                kind: "REFERENCE_SNAPSHOT", 
                referenceCode: { startsWith: `${prefix}_v` } 
            },
            select: { referenceCode: true },
        });

        const existingCodes = existing.map((q: any) => q.referenceCode).filter(Boolean) as string[];
        const nextVersion = computeNextVersion(prefix, existingCodes);
        const newReferenceCode = `${prefix}_v${nextVersion}`;

        const newName = source.name.includes("_UNPUBLISHED_")
            ? source.name.replace("_UNPUBLISHED_", `_${formatYYMMDD(new Date())}_`) + `_v${nextVersion}`
            : source.name;

        const reference = await prisma.questionnaire.create({
            data: {
                fiOrgId: source.fiOrgId,
                ownerOrgId: source.ownerOrgId ?? undefined,
                name: newName,
                functionalCode,
                referenceCode: newReferenceCode,
                status: "ACTIVE",
                isTemplate: true,
                isGlobal: true,
                kind: "REFERENCE_SNAPSHOT",
                visibility: "GLOBAL", // New snapshots default to GLOBAL so they are immediately discoverable; admin can restrict to PRIVATE if needed
                sourceId: workingCopyId, // lineage: derived from this working copy
                fileUrl: source.fileUrl ?? undefined,
                fileName: source.fileName ?? undefined,
                fileType: source.fileType ?? undefined,
                extractedContent: deepCopyJson(source.extractedContent),
                mappings: deepCopyJson(source.mappings),
                processingLogs: {
                    _ref: {
                        sourceId: source.id, // kept for backwards compatibility
                        sourceName: source.name,
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
        return { success: true, referenceId: reference.id, snapshotName: newName, snapshotReferenceCode: newReferenceCode };
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
        where: { id: referenceId, isDeleted: false, kind: "REFERENCE_SNAPSHOT" },
        include: { questions: true },
    });

    if (!source) return { success: false, error: "Reference not found" };

    try {
        const wc = await prisma.questionnaire.create({
            data: {
                fiOrgId: source.fiOrgId,
                ownerOrgId: source.ownerOrgId ?? undefined,
                name: source.name, // Keep existing name
                functionalCode: source.functionalCode,
                referenceCode: source.referenceCode, // Copy for provenance
                status: "DRAFT",
                isTemplate: true,
                isGlobal: false,
                kind: "WORKING_COPY",
                sourceId: referenceId, // lineage: derived from this reference library entry
                fileUrl: source.fileUrl ?? undefined,
                fileName: source.fileName ?? undefined,
                fileType: source.fileType ?? undefined,
                extractedContent: deepCopyJson(source.extractedContent),
                mappings: deepCopyJson(source.mappings),
                processingLogs: {
                    _ref: {
                        sourceId: referenceId, // kept for backwards compatibility
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

// ── Update Visibility ───────────────────────────────────────────────────────
//
// Replaces the old updateSharingState (JSON blob) with a real DB column update.
// Only applies to kind = REFERENCE_SNAPSHOT. Rejects Working Copies and
// Engagement Questionnaires.

export async function updateReferenceSnapshotVisibility(
    snapshotId: string,
    visibility: QuestionnaireVisibility,
): Promise<{ success: boolean; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: snapshotId, isDeleted: false },
        select: { kind: true, isGlobal: true, isTemplate: true },
    });

    if (!source) return { success: false, error: "Questionnaire not found" };

    // Guard: only Reference Snapshots have managed visibility
    const isRef = source.kind === "REFERENCE_SNAPSHOT" || (source.isGlobal && source.isTemplate);
    if (!isRef) {
        return {
            success: false,
            error: "Visibility can only be set on Reference Snapshots. Working Copies and Engagement Questionnaires are always private.",
        };
    }

    try {
        await prisma.questionnaire.update({
            where: { id: snapshotId },
            data: { visibility },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[updateReferenceSnapshotVisibility]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

/**
 * @deprecated Use updateReferenceSnapshotVisibility instead.
 * Kept for backwards compatibility. Delegates to the new action.
 */
export async function updateSharingState(
    referenceId: string,
    state: SharingState,
): Promise<{ success: boolean; error?: string }> {
    return updateReferenceSnapshotVisibility(referenceId, state as QuestionnaireVisibility);
}

// ── V2 Library Lifecycle: Archive & Delete ───────────────────────────────────
//
// Archive  → status = "ARCHIVED"  (hidden from live list, recoverable)
// Delete   → isDeleted = true     (soft-delete, DB row retained for lineage)
//
// Lineage rule: a Reference Snapshot with descendantCount > 0 cannot be deleted.
//               Archive is always allowed regardless of descendants.
//               Working Copies have no lineage restriction.

export async function archiveWorkingCopy(
    workingCopyId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: workingCopyId, isDeleted: false },
        select: { id: true, kind: true, name: true },
    });

    if (!source) return { success: false, error: "Working copy not found" };
    if (source.kind !== "WORKING_COPY") {
        return { success: false, error: "Only Working Copies can be archived via this path" };
    }

    try {
        // Archive = hidden from normal views but recoverable. NOT the same as delete.
        await prisma.questionnaire.update({
            where: { id: workingCopyId },
            data: { status: "ARCHIVED" },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[archiveWorkingCopy]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

export async function deleteWorkingCopy(
    workingCopyId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: workingCopyId, isDeleted: false },
        select: { id: true, kind: true },
    });

    if (!source) return { success: false, error: "Working copy not found" };
    if (source.kind !== "WORKING_COPY") {
        return { success: false, error: "Only Working Copies can be deleted via this path" };
    }

    try {
        await prisma.questionnaire.update({
            where: { id: workingCopyId },
            data: { isDeleted: true },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[deleteWorkingCopy]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

export async function archiveReferenceSnapshot(
    snapshotId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: snapshotId, isDeleted: false },
        select: { id: true, kind: true, isGlobal: true, isTemplate: true },
    });

    if (!source) return { success: false, error: "Reference Snapshot not found" };
    const isRef = source.kind === "REFERENCE_SNAPSHOT" || (source.isGlobal && source.isTemplate);
    if (!isRef) {
        return { success: false, error: "Only Reference Snapshots can be archived via this path" };
    }

    try {
        await prisma.questionnaire.update({
            where: { id: snapshotId },
            data: { status: "ARCHIVED" },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[archiveReferenceSnapshot]", e);
        return { success: false, error: e.message || "Failed" };
    }
}

export async function deleteReferenceSnapshot(
    snapshotId: string,
): Promise<{ success: boolean; error?: string; code?: string }> {
    if (!await isSystemAdmin()) return { success: false, error: "Unauthorized" };

    const source = await prisma.questionnaire.findUnique({
        where: { id: snapshotId, isDeleted: false },
        select: {
            id: true,
            kind: true,
            isGlobal: true,
            isTemplate: true,
            _count: { select: { derivedVersions: true } },
        },
    });

    if (!source) return { success: false, error: "Reference Snapshot not found" };
    const isRef = source.kind === "REFERENCE_SNAPSHOT" || (source.isGlobal && source.isTemplate);
    if (!isRef) {
        return { success: false, error: "Only Reference Snapshots can be deleted via this path" };
    }

    // Lineage guard: descendants counted regardless of their own isDeleted/status.
    if ((source._count as any).derivedVersions > 0) {
        return {
            success: false,
            code: "REFERENCE_SNAPSHOT_HAS_DESCENDANTS",
            error: "Cannot delete because this questionnaire has been used to create other questionnaires.",
        };
    }

    try {
        await prisma.questionnaire.update({
            where: { id: snapshotId },
            data: { isDeleted: true },
        });

        revalidatePath("/app/admin/questionnaires-v2");
        return { success: true };
    } catch (e: any) {
        console.error("[deleteReferenceSnapshot]", e);
        return { success: false, error: e.message || "Failed" };
    }
}
