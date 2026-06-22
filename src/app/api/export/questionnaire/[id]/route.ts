import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { QuestionnairePDF } from "@/components/pdf/questionnaire-pdf";
import { sanitizeFilename } from "@/lib/export/path-builder";
import { v4 as uuidv4 } from "uuid";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
import { KycStateService } from "@/lib/kyc/KycStateService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const resolvedParams = await params;
        const questionnaireId = resolvedParams.id;
        
        if (!questionnaireId) {
            return NextResponse.json({ error: "Missing questionnaire id" }, { status: 400 });
        }

        const identity = await getIdentity();
        const user = identity?.userId ? await prisma.user.findUnique({ where: { id: identity.userId } }) : null;

        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            include: { 
                fiEngagement: { 
                    include: { 
                        org: true, 
                        clientLE: {
                            include: {
                                owners: {
                                    where: { endAt: null },
                                    include: { party: true }
                                }
                            }
                        } 
                    } 
                } 
            }
        });

        if (!questionnaire || questionnaire.isDeleted) {
            return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
        }

        const questions = await prisma.question.findMany({
            where: { questionnaireId },
            orderBy: { order: 'asc' },
            include: {
                comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
                documents: { where: { isDeleted: false } },
                releasedByUser: true
            }
        });

        const subjectLeId = questionnaire.fiEngagement?.clientLE?.legalEntityId;
        const ownerScopeId = questionnaire.fiEngagement?.clientLE?.id ? await KycStateService.resolveScopeId(questionnaire.fiEngagement.clientLE.id) : null;
        const entityId = questionnaire.fiEngagement?.clientLE?.id;

        const exportData = await Promise.all(questions.map(async (question: any) => {
            const resolvedAnswer = await resolveExportAnswer(question, subjectLeId, ownerScopeId || undefined, entityId);

            // For standalone PDF, we just list the document names
            const evidencePaths = question.documents.map((doc: any) => doc.name);

            return {
                id: question.id,
                status: question.status,
                question: question.text,
                text: question.text,
                compactText: question.compactText,
                sectionId: question.sourceSectionId,
                answer: resolvedAnswer.displayValue,
                sourceLabel: resolvedAnswer.sourceLabel,
                sourceTimestamp: resolvedAnswer.sourceTimestamp ? new Date(resolvedAnswer.sourceTimestamp).toISOString() : null,
                sourceCategory: resolvedAnswer.sourceCategory,
                answerState: resolvedAnswer.answerState,
                notes: question.comments.map((c: any) => `[${c.user?.name || 'User'}]: ${c.text}`).join("\n"),
                evidencePaths
            };
        }));

        let answered = 0;
        let registrySourced = 0;
        let userSupplied = 0;
        let noResponse = 0;

        for (const ans of exportData) {
            if (ans.answerState === 'HAS_VALUE' || ans.answerState === 'EMPTY_CHECKED' || ans.answerState === 'EMPTY_DEFAULT') {
                answered++;
            }
            if (ans.sourceCategory === 'REGISTRY') {
                registrySourced++;
            } else if (ans.sourceCategory === 'USER') {
                userSupplied++;
            } else if (ans.sourceCategory === 'NO_RESPONSE') {
                noResponse++;
            }
        }

        const dueDateObj = questionnaire.dueDate || questionnaire.fiEngagement?.dueDate;
        const dueDate = dueDateObj ? new Date(dueDateObj).toISOString() : undefined;

        const summaryStats = {
            totalQuestions: questions.length,
            answered,
            registrySourced,
            userSupplied,
            noResponse,
            dueDate
        };

        const exportId = uuidv4();
        const generatedAt = new Date().toISOString();
        const generatedBy = user?.name || user?.email || identity?.userId || "System";

        const qPdfElement = React.createElement(QuestionnairePDF, {
            title: questionnaire.name,
            exportMetadata: {
                clientParentName: questionnaire.fiEngagement?.clientLE?.owners?.[0]?.party?.name,
                clientDisplayName: questionnaire.fiEngagement?.clientLE?.name || "Unknown Client Legal Entity",
                supplierDisplayName: questionnaire.fiEngagement?.org?.name || "Unknown Supplier",
                exportFormatVersion: "1.0.0",
                applicationVersion: "0.1.0",
                generatedBy,
                generatedAt,
                exportId,
                summaryStats
            },
            data: exportData
        });

        const pdfStream = await renderToStream(qPdfElement as any);
        
        const filename = `${sanitizeFilename(questionnaire.name)}.pdf`;

        // @ts-ignore
        return new NextResponse(pdfStream as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error("Questionnaire PDF Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
    }
}
