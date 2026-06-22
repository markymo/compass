import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuestionnairePDF } from "@/components/pdf/questionnaire-pdf";

export async function GET() {
    try {
        const qPdfElement = React.createElement(QuestionnairePDF, {
            title: "Test",
            exportMetadata: {
                exportId: "123",
                generatedAt: new Date().toISOString(),
                generatedBy: "Mark",
                engagementName: "Test Eng",
                clientDisplayName: "Client",
                supplierDisplayName: "Supplier",
                exportFormatVersion: "1.0",
                applicationVersion: "1.0"
            },
            data: []
        });

        await renderToStream(qPdfElement as any);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
