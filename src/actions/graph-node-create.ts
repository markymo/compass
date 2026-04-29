"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export type CreateGraphNodeInput = {
    clientLEId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    // For PERSON
    firstName?: string;
    lastName?: string;
    nationality?: string;
    // For LEGAL_ENTITY
    entityName?: string;
    registrationNumber?: string;
    // For ADDRESS
    line1?: string;
    city?: string;
    country?: string;
};

export async function createGraphNodeAction(input: CreateGraphNodeInput) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        let createdId: string | null = null;

        if (input.nodeType === "PERSON") {
            const p = await prisma.person.create({
                data: {
                    firstName: input.firstName || "",
                    lastName: input.lastName || "",
                    primaryNationality: input.nationality,
                }
            });
            createdId = p.id;
        } else if (input.nodeType === "LEGAL_ENTITY") {
            const le = await prisma.legalEntity.create({
                data: {
                    name: input.entityName || "New Entity",
                    localRegistrationNumber: input.registrationNumber,
                }
            });
            createdId = le.id;
        } else if (input.nodeType === "ADDRESS") {
            const addr = await prisma.address.create({
                data: {
                    line1: input.line1 || "",
                    city: input.city,
                    country: input.country || "Unknown",
                }
            });
            createdId = addr.id;
        }

        if (!createdId) throw new Error("Unsupported node type or missing data");

        // Create the Graph Node wrapper
        const node = await (prisma as any).clientLEGraphNode.create({
            data: {
                clientLEId: input.clientLEId,
                nodeType: input.nodeType,
                personId: input.nodeType === "PERSON" ? createdId : null,
                legalEntityId: input.nodeType === "LEGAL_ENTITY" ? createdId : null,
                addressId: input.nodeType === "ADDRESS" ? createdId : null,
                source: "USER_INPUT"
            }
        });

        revalidatePath(`/app/le/${input.clientLEId}`);
        return { success: true, nodeId: node.id, entityId: createdId };
    } catch (e: any) {
        console.error("createGraphNodeAction error:", e);
        return { success: false, error: e.message || String(e) };
    }
}

export type UpdateGraphNodeInput = {
    clientLEId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    entityId: string;
    // PERSON
    firstName?: string;
    lastName?: string;
    nationality?: string;
    // LEGAL_ENTITY
    entityName?: string;
    registrationNumber?: string;
    // ADDRESS
    line1?: string;
    city?: string;
    country?: string;
};

import { logAudit } from "@/services/audit";

export async function updateGraphNodeAction(input: UpdateGraphNodeInput) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (input.nodeType === "PERSON") {
                const current = await tx.person.findUniqueOrThrow({ where: { id: input.entityId } });
                const updated = await tx.person.update({
                    where: { id: input.entityId },
                    data: {
                        firstName: input.firstName,
                        lastName: input.lastName,
                        primaryNationality: input.nationality,
                    }
                });
                await logAudit(tx, {
                    entityType: "PERSON",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: ["firstName", "lastName", "primaryNationality"],
                    oldData: { firstName: current.firstName, lastName: current.lastName, primaryNationality: current.primaryNationality },
                    newData: { firstName: updated.firstName, lastName: updated.lastName, primaryNationality: updated.primaryNationality },
                    actorUserId: identity.userId,
                    sourceType: "UI",
                });
            } else if (input.nodeType === "LEGAL_ENTITY") {
                const current = await tx.legalEntity.findUniqueOrThrow({ where: { id: input.entityId } });
                const updated = await tx.legalEntity.update({
                    where: { id: input.entityId },
                    data: {
                        name: input.entityName || "Updated Entity",
                        localRegistrationNumber: input.registrationNumber,
                    }
                });
                await logAudit(tx, {
                    entityType: "LEGAL_ENTITY",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: ["name", "localRegistrationNumber"],
                    oldData: { name: current.name, localRegistrationNumber: current.localRegistrationNumber },
                    newData: { name: updated.name, localRegistrationNumber: updated.localRegistrationNumber },
                    actorUserId: identity.userId,
                    sourceType: "UI",
                });
            } else if (input.nodeType === "ADDRESS") {
                const current = await tx.address.findUniqueOrThrow({ where: { id: input.entityId } });
                const updated = await tx.address.update({
                    where: { id: input.entityId },
                    data: {
                        line1: input.line1 || "Updated Address",
                        city: input.city,
                        country: input.country,
                    }
                });
                await logAudit(tx, {
                    entityType: "ADDRESS",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: ["line1", "city", "country"],
                    oldData: { line1: current.line1, city: current.city, country: current.country },
                    newData: { line1: updated.line1, city: updated.city, country: updated.country },
                    actorUserId: identity.userId,
                    sourceType: "UI",
                });
            }
        });

        revalidatePath(`/app/le/${input.clientLEId}`);
        return { success: true };
    } catch (e: any) {
        console.error("updateGraphNodeAction error:", e);
        return { success: false, error: e.message || String(e) };
    }
}

