import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // 1. Fetch Questionnaire
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id },
    });

    if (!questionnaire || !questionnaire.fileContent) {
        return new NextResponse("File not found", { status: 404 });
    }

    // 2. Prepare headers
    const headers = new Headers();
    headers.set("Content-Type", questionnaire.fileType || "application/octet-stream");
    headers.set("Content-Disposition", `inline; filename="${questionnaire.fileName}"`);

    // 3. Return the file
    // fileContent is Bytes (Buffer), send it directly
    return new NextResponse(questionnaire.fileContent, {
        status: 200,
        headers,
    });
}
