"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";

export interface CCFileRecord {
    id: string;
    name: string;
    fileUrl: string;
    fileType: string;
    createdAt: Date;
    usage: { fieldNo: number; fieldName: string }[];
}

export async function getCCFiles(clientLEId: string): Promise<CCFileRecord[]> {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized");
    }

    // Find all FILE_ATTACHMENT claims for this client LE that actually have a document attached
    const claims = await prisma.fieldClaim.findMany({
        where: {
            clientLeScopeId: clientLEId,
            claimRole: 'FILE_ATTACHMENT',
            attachmentDocumentId: { not: null }
        },
        include: {
            attachmentDocument: true
        }
    });

    const docMap = new Map<string, CCFileRecord>();
    const defMap = new Map<number, string>();

    for (const claim of claims) {
        const doc = claim.attachmentDocument;
        if (!doc) continue;

        if (!docMap.has(doc.id)) {
            docMap.set(doc.id, {
                id: doc.id,
                name: doc.name,
                fileUrl: doc.fileUrl,
                fileType: doc.fileType,
                createdAt: doc.createdAt,
                usage: []
            });
        }

        const docRecord = docMap.get(doc.id)!;
        // Avoid duplicate usage records for the same field
        if (!docRecord.usage.some((u) => u.fieldNo === claim.fieldNo)) {
            if (!defMap.has(claim.fieldNo)) {
                try {
                    const def = await getMasterFieldDefinition(claim.fieldNo);
                    defMap.set(claim.fieldNo, def.fieldName);
                } catch (e) {
                    defMap.set(claim.fieldNo, `Field ${claim.fieldNo}`);
                }
            }
            docRecord.usage.push({
                fieldNo: claim.fieldNo,
                fieldName: defMap.get(claim.fieldNo) as string
            });
        }
    }

    return Array.from(docMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
