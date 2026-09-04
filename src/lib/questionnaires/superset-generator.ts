import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateWorkingCopyTitle } from "@/lib/questionnaires/reference-codes";
import { syncQuestionsToDatabase } from "./question-sync";

export interface SupersetGeneratorOptions {
    dryRun?: boolean;
    force?: boolean;
}

export interface SupersetGeneratorResult {
    success: boolean;
    dryRun?: boolean;
    questionnaireId?: string;
    proposedName?: string;
    isExisting?: boolean;
    questionCount: number;
    items?: any[];
    error?: string;
}

export async function generateSupersetWorkingCopy(
    options: SupersetGeneratorOptions = {}
): Promise<SupersetGeneratorResult> {
    try {
        // 1. Query all active Master Field definitions strictly in deterministic ascending order
        const activeFields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: { fieldNo: "asc" },
            select: { fieldNo: true, fieldName: true }
        });

        // 2. Build canonical question items
        const items = activeFields.map((field: { fieldNo: number; fieldName: string }, idx: number) => ({
            type: "question",
            text: field.fieldName,
            compactText: field.fieldName.slice(0, 100),
            order: idx + 1,
            masterFieldNo: field.fieldNo,
            masterQuestionGroupId: null,
            customFieldDefinitionId: null,
        }));

        const proposedName = generateWorkingCopyTitle({
            functionalCode: "SUPERSET",
            isSystemQuestionnaire: true,
        });

        // 3. Dry-run early exit (zero database writes)
        if (options.dryRun) {
            return {
                success: true,
                dryRun: true,
                proposedName,
                questionCount: items.length,
                items,
            };
        }

        // 4. Resolve platform System Organization
        const sysOrg = await prisma.organization.findFirst({
            where: { types: { has: "SYSTEM" } }
        });

        if (!sysOrg) {
            return {
                success: false,
                questionCount: 0,
                error: "System Organization not found",
            };
        }

        // 5. Atomic creation/replacement inside a Prisma transaction
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Check for existing Working Copy with functionalCode = SUPERSET
            const existing = await tx.questionnaire.findFirst({
                where: {
                    functionalCode: "SUPERSET",
                    kind: "WORKING_COPY",
                    isDeleted: false,
                },
                include: {
                    _count: { select: { questions: true } }
                }
            });

            if (existing) {
                if (!options.force) {
                    return {
                        success: true,
                        questionnaireId: existing.id,
                        isExisting: true,
                        questionCount: existing._count.questions,
                    };
                }

                // Clarification 1: --force may replace only an existing functionalCode = SUPERSET,
                // kind = WORKING_COPY questionnaire. It must never alter/delete a published Reference Snapshot.
                await tx.question.deleteMany({
                    where: { questionnaireId: existing.id }
                });
                await tx.questionnaire.delete({
                    where: { id: existing.id }
                });
            }

            // Create Questionnaire header with extractedContent
            const workingCopy = await tx.questionnaire.create({
                data: {
                    name: proposedName,
                    functionalCode: "SUPERSET",
                    fiOrgId: sysOrg.id,
                    ownerOrgId: sysOrg.id,
                    kind: "WORKING_COPY",
                    isTemplate: true,
                    isGlobal: false,
                    visibility: "PRIVATE",
                    extractedContent: items,
                }
            });

            // Synchronize relational Question rows using canonical persistence lifecycle within the transaction
            await syncQuestionsToDatabase(workingCopy.id, items, null, tx);

            return {
                success: true,
                questionnaireId: workingCopy.id,
                questionCount: items.length,
            };
        }, {
            maxWait: 10000,
            timeout: 30000,
        });

        return result;
    } catch (e: any) {
        console.error("[generateSupersetWorkingCopy]", e);
        return {
            success: false,
            questionCount: 0,
            error: e.message || "Failed to generate Superset working copy",
        };
    }
}
