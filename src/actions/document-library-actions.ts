"use server";

import { getIdentity } from "@/lib/auth";
import { Action, can } from "@/lib/auth/permissions";
import { DocumentLibraryService } from "@/lib/documents/DocumentLibraryService";
import { DocumentDetailDTO } from "@/lib/documents/DocumentLibraryDTOs";
import prisma from "@/lib/prisma";

export async function getLibraryDocumentDetailsAction(documentId: string, clientLEId: string): Promise<DocumentDetailDTO> {
    const identity = await getIdentity();
    if (!identity?.userId) {
        throw new Error("Unauthorized: Not logged in");
    }

    // Check permissions on the target LE
    const hasAccess = await can(identity, Action.LE_VIEW_MASTER_DATA, { clientLEId });
    if (!hasAccess) {
        throw new Error("Unauthorized: Access denied to Client LE");
    }

    // The service internally verifies the document belongs to clientLEId
    return DocumentLibraryService.getDocumentDetails(documentId, clientLEId);
}
