"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createVersion(
    questionnaireId: string,
    snapshotData: any, // JSON
    pdfBase64: string // Base64 string of the PDF
) {
    try {
        // 1. Get current version count
        const count = await prisma.questionnaireVersion.count({
            where: { questionnaireId }
        });

        // 2. Decode base64 PDF
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        console.log(`[createVersion] PDF Buffer size: ${pdfBuffer.length} bytes`);

        // 3. Create new version
        const version = await prisma.questionnaireVersion.create({
            data: {
                questionnaireId,
                versionNumber: count + 1,
                snapshotData,
                pdfContent: pdfBuffer
            }
        });

        revalidatePath(`/app/le/${snapshotData.leId}/v2`); // Revalidate generally, though local state updates might mask this
        return { success: true, versionId: version.id, versionNumber: version.versionNumber };
    } catch (error: any) {
        console.error("Error creating version:", error);
        return { success: false, error: "Failed to create version: " + (error.message || String(error)) };
    }
}

export async function getVersions(questionnaireId: string) {
    try {
        const versions = await prisma.questionnaireVersion.findMany({
            where: { questionnaireId },
            orderBy: { versionNumber: 'desc' },
            select: {
                id: true,
                versionNumber: true,
                createdAt: true,
                // Do NOT select pdfContent or snapshotData to keep payload light for list
            }
        });
        return { success: true, data: versions };
    } catch (error) {
        console.error("Error fetching versions:", error);
        return { success: false, error: "Failed to fetch versions" };
    }
}

export async function getVersionPDF(versionId: string) {
    try {
        const version = await prisma.questionnaireVersion.findUnique({
            where: { id: versionId },
            select: { pdfContent: true }
        });

        if (!version) return { success: false, error: "Version not found" };

        console.log(`[getVersionPDF] Retrieved PDF Buffer size: ${version.pdfContent.length} bytes`);

        // Convert buffer to base64 to send back to client
        // Ensure it is a Buffer before toString (Prisma might return Uint8Array)
        const base64 = Buffer.from(version.pdfContent).toString('base64');
        return { success: true, pdfBase64: base64 };
    } catch (error) {
        console.error("Error fetching PDF:", error);
        return { success: false, error: "Failed to fetch PDF" };
    }
}
