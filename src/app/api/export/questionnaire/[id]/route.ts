import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { QuestionnairePDF } from "@/components/pdf/questionnaire-pdf";
import { sanitizeFilename } from "@/lib/export/path-builder";
import { v4 as uuidv4 } from "uuid";

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
            include: { fiEngagement: { include: { org: true } } }
        });

        if (!questionnaire) {
            return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
        }

        const questions = await prisma.question.findMany({
            where: { questionnaireId },
            orderBy: { order: 'asc' },
            include: {
                comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
                documents: { where: { isDeleted: false } }
            }
        });

        const exportData = questions.map((question: any) => {
            let resolvedAnswer = question.answer || "";
            if (typeof resolvedAnswer === 'object' && resolvedAnswer !== null) {
                resolvedAnswer = JSON.stringify(resolvedAnswer);
            } else {
                resolvedAnswer = String(resolvedAnswer ?? "");
            }

            // For standalone PDF, we just list the document names
            const evidencePaths = question.documents.map((doc: any) => doc.name);

            return {
                id: question.id,
                status: question.status,
                question: question.text,
                answer: resolvedAnswer,
                notes: question.comments.map((c: any) => `[${c.user?.name || 'User'}]: ${c.text}`).join("\n"),
                evidencePaths
            };
        });

        const exportId = uuidv4();
        const generatedAt = new Date().toISOString();
        const engagementName = questionnaire.fiEngagement?.org?.name || "Unknown Engagement";
        
        const qPdfElement = React.createElement(QuestionnairePDF, {
            title: questionnaire.name,
            exportMetadata: {
                exportId,
                generatedAt,
                generatedBy: user?.name || user?.email || "Unknown User",
                engagementName,
                exportFormatVersion: "1.0.0",
                applicationVersion: "0.1.0"
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
