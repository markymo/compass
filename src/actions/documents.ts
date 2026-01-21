"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { del } from '@vercel/blob';

/**
 * Save Document Metadata after Vercel Blob Upload
 */
export async function uploadDocument(clientLEId: string, data: { name: string, type: string, fileUrl: string, docType?: string, kbSize?: number }) {
    try {
        const doc = await prisma.document.create({
            data: {
                clientLEId,
                name: data.name,
                fileType: data.type,
                fileUrl: data.fileUrl,
                kbSize: data.kbSize || 0,
                docType: data.docType || "UNCATEGORIZED",
                isVerified: false
            }
        });
        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true, document: doc };
    } catch (error) {
        console.error("Failed to upload document:", error);
        return { success: false, error: "Database error during upload" };
    }
}

/**
 * Get all active documents for a Client LE (The Vault).
 */
export async function getVaultDocuments(clientLEId: string) {
    try {
        const docs = await prisma.document.findMany({
            where: { clientLEId, isDeleted: false },
            orderBy: { createdAt: 'desc' },
            include: {
                sharedWith: {
                    select: {
                        id: true,
                        org: { select: { name: true } }
                    }
                }
            }
        });
        return { success: true, documents: docs };
    } catch (error) {
        return { success: false, error: "Failed to fetch vault" };
    }
}

/**
 * Get documents specifically shared with an Engagement.
 */
export async function getEngagementDocuments(engagementId: string) {
    try {
        // Find the engagement and include relation to Documents
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: {
                sharedDocuments: {
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };

        return { success: true, documents: engagement.sharedDocuments };
    } catch (error) {
        return { success: false, error: "Failed to fetch shared documents" };
    }
}

/**
 * Share a document with an Engagement (Access Granted).
 */
export async function shareDocument(documentId: string, engagementId: string) {
    try {
        await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: {
                sharedDocuments: {
                    connect: { id: documentId }
                }
            }
        });
        // Revalidate both the engagement page and the vault page (to show "Shared" status)
        revalidatePath(`/app/le`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to share document" };
    }
}

/**
 * Revoke access to a document for an Engagement.
 */
export async function revokeDocumentAccess(documentId: string, engagementId: string) {
    try {
        await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: {
                sharedDocuments: {
                    disconnect: { id: documentId }
                }
            }
        });
        revalidatePath(`/app/le`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to revoke access" };
    }
}

/**
 * Soft Delete a document from the Vault and Hard Delete from Blob.
 */
export async function deleteDocument(documentId: string) {
    try {
        const doc = await prisma.document.findUnique({ where: { id: documentId } });

        if (doc && doc.fileUrl.includes('public.blob.vercel-storage.com')) {
            // Attempt to delete from blob storage
            try { await del(doc.fileUrl); } catch (e) { console.warn("Failed to delete blob", e) }
        }

        await prisma.document.update({
            where: { id: documentId },
            data: { isDeleted: true }
        });
        revalidatePath(`/app/le`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete document" };
    }
}
