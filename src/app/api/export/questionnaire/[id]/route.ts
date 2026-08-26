import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { QuestionnairePDF } from "@/components/pdf/questionnaire-pdf";
import { sanitizeFilename } from "@/lib/export/path-builder";
import { v4 as uuidv4 } from "uuid";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
import { resolveQuestionnaireContext } from "@/lib/kyc/engagement-context";
import { resolveSystemTimezone } from "@/lib/date-utils";

import { Action, can, UserWithMemberships } from "@/lib/auth/permissions";
import { isPlatformQuestionnaire } from "@/lib/questionnaires/questionnaire-ownership";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const resolvedParams = await params;
        const questionnaireId = resolvedParams.id;
        
        if (!questionnaireId) {
            return NextResponse.json({ error: "Missing questionnaire id" }, { status: 400 });
        }

        const identity = await getIdentity();
        if (!identity?.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { userId } = identity;

        const explicitEngagementId = req.nextUrl.searchParams.get('engagementId') || undefined;
        const submissionId = req.nextUrl.searchParams.get('submissionId') || undefined;

        const ctx = await resolveQuestionnaireContext(questionnaireId, explicitEngagementId);
        if (!ctx || !ctx.questionnaire || ctx.questionnaire.isDeleted) {
            return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
        }
        const { questionnaire, engagement, clientLE, subjectLeId, ownerScopeId, clientLeId: entityId } = ctx;

        // Authorize caller against underlying ClientLE / Engagement / Questionnaire
        let allowed = false;

        const memberships = await prisma.membership.findMany({
            where: { userId },
            select: {
                organizationId: true,
                clientLEId: true,
                fiEngagementId: true,
                role: true,
                clientLE: { select: { isDeleted: true, status: true } }
            }
        });
        const user: UserWithMemberships = { id: userId, memberships };

        // Platform-owned template export allowed for System Admin (strictly verified as System Org asset)
        const isPlatform = await isPlatformQuestionnaire(questionnaire, prisma);
        if (isPlatform && !engagement && !entityId && !explicitEngagementId) {
            allowed = await can(user, Action.SYSTEM_MANAGE_PLATFORM, {}, prisma);
        }

        if (!allowed) {

            if (entityId) {
                allowed = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: entityId }, prisma);
            }
            if (!allowed && (engagement?.id || explicitEngagementId)) {
                const targetEngId = engagement?.id || explicitEngagementId;
                allowed = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: targetEngId }, prisma);
            }
            if (!allowed && questionnaire.fiOrgId) {
                allowed = await can(user, Action.QUESTIONNAIRE_UPDATE, { partyId: questionnaire.fiOrgId }, prisma);
            }
        }

        if (!allowed) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const userRecord = await prisma.user.findUnique({ where: { id: userId } });

        const questions = await prisma.question.findMany({
            where: { questionnaireId },
            orderBy: { order: 'asc' },
            include: {
                comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
                documents: { where: { isDeleted: false } },
                releasedByUser: true
            }
        });

        const exportData = await Promise.all(questions.map(async (question: any) => {
            const resolvedAnswer = await resolveExportAnswer(question, subjectLeId, ownerScopeId || undefined, entityId, submissionId);

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
                displayContext: resolvedAnswer.displayContext,
                sourceLabel: resolvedAnswer.sourceLabel,
                sourceTimestamp: resolvedAnswer.sourceTimestamp ? new Date(resolvedAnswer.sourceTimestamp).toISOString() : null,
                sourceCategory: resolvedAnswer.sourceCategory,
                answerState: resolvedAnswer.answerState,
                notes: question.comments.map((c: any) => `[${c.user?.name || 'User'}]: ${c.text}`).join("\n"),
                evidencePaths,
                groupFields: resolvedAnswer.groupFields,
                groupDisplayStyle: resolvedAnswer.groupDisplayStyle,
                attachmentFilenames: resolvedAnswer.attachmentFilenames
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

        const dueDateObj = questionnaire.dueDate || engagement?.dueDate;
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
        const generatedBy = userRecord?.name || userRecord?.email || identity?.userId || "System";
        const timezone = resolveSystemTimezone(userRecord?.preferences);

        const qPdfElement = React.createElement(QuestionnairePDF, {
            title: questionnaire.name,
            exportMetadata: {
                clientParentName: clientLE?.owners?.[0]?.party?.name,
                clientDisplayName: clientLE?.name || "Unknown Client Legal Entity",
                supplierDisplayName: engagement?.org?.name || "Unknown Supplier",
                exportFormatVersion: "1.0.0",
                applicationVersion: "0.1.0",
                generatedBy,
                generatedAt,
                timezone,
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
