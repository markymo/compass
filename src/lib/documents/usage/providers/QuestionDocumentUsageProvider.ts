import { DocumentUsageProvider } from '../DocumentUsageProvider';
import { DocumentUsage } from '../types';
import prisma from "@/lib/prisma";

export class QuestionDocumentUsageProvider implements DocumentUsageProvider {
    async getActiveUsages(clientLEId: string, documentIds: string[]): Promise<DocumentUsage[]> {
        const documents = await prisma.document.findMany({
            where: {
                id: { in: documentIds },
                clientLEId,
                questionId: { not: null },
                isDeleted: false
            },
            include: {
                question: {
                    include: {
                        questionnaire: true
                    }
                }
            }
        });

        const usages: DocumentUsage[] = [];

        for (const doc of documents) {
            if (!doc.question) continue;
            
            usages.push({
                documentId: doc.id,
                type: 'QUESTION_ATTACHMENT',
                instanceId: doc.question.id,
                attachedAt: doc.updatedAt,
                isActive: true,
                display: {
                    title: `Question in ${doc.question.questionnaire.name}`,
                    subtitle: doc.question.compactText || doc.question.text
                },
                metadata: {
                    questionId: doc.question.id,
                    questionnaireId: doc.question.questionnaireId
                }
            });
        }

        return usages;
    }
}
