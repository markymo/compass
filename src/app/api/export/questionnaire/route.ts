import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuestionnairePDF } from "@/components/pdf/questionnaire-pdf";
import { KycStateService } from "@/lib/kyc/KycStateService";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { engagementId, format, questionnaireId } = body;

        if (!engagementId || !format) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch Engagement & Data
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: { org: true, clientLE: true }
        });

        if (!engagement) {
            return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
        }

        // --- Resolved Master Data Context ---
        const subjectLeId = engagement.clientLE.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(engagement.clientLEId);

        // 2. Fetch Questions (Logic mirroring kanban-actions)
        // Filters: by engagement, and optional questionnaireId
        const whereClause: any = {
            OR: [
                { questionnaire: { engagements: { some: { id: engagementId } } } },
                { questionnaire: { fiEngagementId: engagementId } }
            ]
        };

        if (questionnaireId && questionnaireId !== 'all') {
            whereClause.AND = { questionnaireId };
        }

        const questions = await prisma.question.findMany({
            where: whereClause,
            orderBy: { order: 'asc' },
            include: {
                comments: {
                    include: { user: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        const exportData = await Promise.all(questions.map(async (q: any) => {
            let resolvedAnswer = q.answer || "";
            const isReleased = (q.status as any) === 'RELEASED';
            const snapshotDate = isReleased ? (q as any).releasedAt : undefined;

            // Use KycStateService to get the latest authoritative value if mapped
            if (subjectLeId && q.masterFieldNo) {
                const derived = await KycStateService.getAuthoritativeValue(
                    { subjectLeId },
                    q.masterFieldNo,
                    ownerScopeId || undefined,
                    snapshotDate
                );

                if (derived) {
                    // Handle complex values (e.g. JSON or multiple lines)
                    if (typeof derived.value === 'object' && derived.value !== null) {
                        resolvedAnswer = JSON.stringify(derived.value);
                    } else {
                        resolvedAnswer = String(derived.value ?? "");
                    }
                }
            }

            return {
                id: q.id,
                status: q.status,
                question: q.text,
                answer: resolvedAnswer,
                notes: q.comments.map((c: any) => `[${c.user?.name || 'User'}]: ${c.text}`).join("\n")
            };
        }));

        const filename = `${engagement.clientLE.name.replace(/\s+/g, '_')}_Questionnaire_${new Date().toISOString().split('T')[0]}`;

        // 4. Handle Excel
        if (format === 'EXCEL') {
            const worksheet = XLSX.utils.json_to_sheet(exportData.map((d: any) => ({
                Question: d.question,
                Answer: d.answer,
                Status: d.status,
                Notes: d.notes
            })));

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Questionnaire");

            // Generate buffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

            return new NextResponse(excelBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}.xlsx"`
                }
            });
        }

        // 5. Handle PDF
        if (format === 'PDF') {
            // Use createElement to avoid JSX in .ts file
            const element = React.createElement(QuestionnairePDF, {
                data: exportData,
                title: engagement.clientLE.name
            });
            const stream = await renderToStream(element);

            return new NextResponse(stream as any, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`
                }
            });
        }

        return NextResponse.json({ error: "Invalid format" }, { status: 400 });

    } catch (error: any) {
        console.error("Export Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
