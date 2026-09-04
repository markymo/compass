import prisma from "@/lib/prisma";
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

        // 4. Check for existing Working Copy with functionalCode = SUPERSET
        const existing = await prisma.questionnaire.findFirst({
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
            await prisma.question.deleteMany({
                where: { questionnaireId: existing.id }
            });
            await prisma.questionnaire.delete({
                where: { id: existing.id }
            });
        }

        // 5. Resolve platform System Organization
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

        // 6. Create Questionnaire header with extractedContent
        const workingCopy = await prisma.questionnaire.create({
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

        // 7. Synchronize relational Question rows using canonical persistence lifecycle
        await syncQuestionsToDatabase(workingCopy.id, items);

        return {
            success: true,
            questionnaireId: workingCopy.id,
            questionCount: items.length,
        };
    } catch (e: any) {
        console.error("[generateSupersetWorkingCopy]", e);
        return {
            success: false,
            questionCount: 0,
            error: e.message || "Failed to generate Superset working copy",
        };
    }
}
