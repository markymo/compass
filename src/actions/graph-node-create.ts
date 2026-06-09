"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/services/audit";

// ── Create ─────────────────────────────────────────────────────────────────────

export type CreateGraphNodeInput = {
    clientLEId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    // PERSON — all Model A fields
    firstName?: string;
    lastName?: string;
    middleName?: string;
    title?: string;
    dateOfBirth?: string | null;  // ISO date string "YYYY-MM-DD" or null
    placeOfBirth?: string;
    nationality?: string;         // maps to primaryNationality
    officerRole?: string;
    occupation?: string;
    countryOfResidence?: string;
    isPublicFigure?: boolean;
    // LEGAL_ENTITY — all Model A fields
    entityName?: string;
    registrationNumber?: string;
    jurisdiction?: string;
    legalForm?: string;
    entityStatus?: string;
    countryOfIncorporation?: string;
    // ADDRESS — all Model A fields
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
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
                    firstName:          input.firstName          || "",
                    lastName:           input.lastName           || "",
                    middleName:         input.middleName         || null,
                    title:              input.title              || null,
                    dateOfBirth:        input.dateOfBirth        ? new Date(input.dateOfBirth) : null,
                    placeOfBirth:       input.placeOfBirth       || null,
                    primaryNationality: input.nationality        || null,
                    officerRole:        input.officerRole        || null,
                    occupation:         input.occupation         || null,
                    countryOfResidence: input.countryOfResidence || null,
                    isPublicFigure:     input.isPublicFigure     ?? false,
                }
            });
            createdId = p.id;

        } else if (input.nodeType === "LEGAL_ENTITY") {
            const le = await prisma.legalEntity.create({
                data: {
                    name:                    input.entityName          || "New Entity",
                    localRegistrationNumber: input.registrationNumber  || null,
                    jurisdiction:            input.jurisdiction         || null,
                    legalForm:               input.legalForm            || null,
                    entityStatus:            input.entityStatus         || null,
                    countryOfIncorporation:  input.countryOfIncorporation || null,
                }
            });
            createdId = le.id;

        } else if (input.nodeType === "ADDRESS") {
            const addr = await prisma.address.create({
                data: {
                    line1:      input.line1      || "",
                    line2:      input.line2      || null,
                    city:       input.city       || null,
                    region:     input.region     || null,
                    postalCode: input.postalCode || null,
                    country:    input.country    || "",
                }
            });
            createdId = addr.id;
        }

        if (!createdId) throw new Error("Unsupported node type or missing data");

        // ── Find-or-create the Graph Node wrapper ─────────────────────────────
        const nodeWhere =
            input.nodeType === "PERSON"       ? { clientLEId: input.clientLEId, personId:      createdId } :
            input.nodeType === "LEGAL_ENTITY" ? { clientLEId: input.clientLEId, legalEntityId: createdId } :
                                                { clientLEId: input.clientLEId, addressId:     createdId };

        let node = await (prisma as any).clientLEGraphNode.findFirst({ where: nodeWhere });
        if (!node) {
            node = await (prisma as any).clientLEGraphNode.create({
                data: {
                    clientLEId: input.clientLEId,
                    nodeType: input.nodeType,
                    personId:      input.nodeType === "PERSON"       ? createdId : null,
                    legalEntityId: input.nodeType === "LEGAL_ENTITY" ? createdId : null,
                    addressId:     input.nodeType === "ADDRESS"      ? createdId : null,
                    source: "USER_INPUT"
                }
            });
        }

        revalidatePath(`/app/le/${input.clientLEId}`);
        return { success: true, nodeId: node.id, entityId: createdId };
    } catch (e: any) {
        console.error("createGraphNodeAction error:", e);
        return { success: false, error: e.message || String(e) };
    }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export type UpdateGraphNodeInput = {
    clientLEId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    entityId: string;
    // PERSON — all Model A fields
    firstName?: string;
    lastName?: string;
    middleName?: string;
    title?: string;
    dateOfBirth?: string | null;
    placeOfBirth?: string;
    nationality?: string;
    officerRole?: string;
    occupation?: string;
    countryOfResidence?: string;
    isPublicFigure?: boolean;
    // LEGAL_ENTITY — all Model A fields
    entityName?: string;
    registrationNumber?: string;
    jurisdiction?: string;
    legalForm?: string;
    entityStatus?: string;
    countryOfIncorporation?: string;
    // ADDRESS — all Model A fields
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
};

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
                        ...(input.firstName          !== undefined && { firstName:          input.firstName }),
                        ...(input.lastName           !== undefined && { lastName:           input.lastName }),
                        ...(input.middleName         !== undefined && { middleName:         input.middleName         || null }),
                        ...(input.title              !== undefined && { title:              input.title              || null }),
                        ...(input.dateOfBirth        !== undefined && { dateOfBirth:        input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
                        ...(input.placeOfBirth       !== undefined && { placeOfBirth:       input.placeOfBirth       || null }),
                        ...(input.nationality        !== undefined && { primaryNationality: input.nationality        || null }),
                        ...(input.officerRole        !== undefined && { officerRole:        input.officerRole        || null }),
                        ...(input.occupation         !== undefined && { occupation:         input.occupation         || null }),
                        ...(input.countryOfResidence !== undefined && { countryOfResidence: input.countryOfResidence || null }),
                        ...(input.isPublicFigure     !== undefined && { isPublicFigure:     input.isPublicFigure }),
                    }
                });
                const personFields = ["firstName","lastName","middleName","title","dateOfBirth","placeOfBirth","primaryNationality","officerRole","occupation","countryOfResidence","isPublicFigure"] as const;
                await logAudit(tx, {
                    entityType: "PERSON",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: [...personFields],
                    oldData: Object.fromEntries(personFields.map(f => [f, (current as any)[f]])),
                    newData: Object.fromEntries(personFields.map(f => [f, (updated as any)[f]])),
                    actorUserId: identity.userId,
                    sourceType: "UI",
                });

            } else if (input.nodeType === "LEGAL_ENTITY") {
                const current = await tx.legalEntity.findUniqueOrThrow({ where: { id: input.entityId } });
                const updated = await tx.legalEntity.update({
                    where: { id: input.entityId },
                    data: {
                        ...(input.entityName            !== undefined && { name:                    input.entityName            || "Updated Entity" }),
                        ...(input.registrationNumber    !== undefined && { localRegistrationNumber: input.registrationNumber    || null }),
                        ...(input.jurisdiction          !== undefined && { jurisdiction:            input.jurisdiction          || null }),
                        ...(input.legalForm             !== undefined && { legalForm:               input.legalForm             || null }),
                        ...(input.entityStatus          !== undefined && { entityStatus:            input.entityStatus          || null }),
                        ...(input.countryOfIncorporation !== undefined && { countryOfIncorporation: input.countryOfIncorporation || null }),
                    }
                });
                const leFields = ["name","localRegistrationNumber","jurisdiction","legalForm","entityStatus","countryOfIncorporation"] as const;
                await logAudit(tx, {
                    entityType: "LEGAL_ENTITY",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: [...leFields],
                    oldData: Object.fromEntries(leFields.map(f => [f, (current as any)[f]])),
                    newData: Object.fromEntries(leFields.map(f => [f, (updated as any)[f]])),
                    actorUserId: identity.userId,
                    sourceType: "UI",
                });

            } else if (input.nodeType === "ADDRESS") {
                const current = await tx.address.findUniqueOrThrow({ where: { id: input.entityId } });
                const updated = await tx.address.update({
                    where: { id: input.entityId },
                    data: {
                        ...(input.line1      !== undefined && { line1:      input.line1      || "" }),
                        ...(input.line2      !== undefined && { line2:      input.line2      || null }),
                        ...(input.city       !== undefined && { city:       input.city       || null }),
                        ...(input.region     !== undefined && { region:     input.region     || null }),
                        ...(input.postalCode !== undefined && { postalCode: input.postalCode || null }),
                        ...(input.country    !== undefined && { country:    input.country    || "" }),
                    }
                });
                const addrFields = ["line1","line2","city","region","postalCode","country"] as const;
                await logAudit(tx, {
                    entityType: "ADDRESS",
                    entityId: input.entityId,
                    action: "UPDATE",
                    changedFields: [...addrFields],
                    oldData: Object.fromEntries(addrFields.map(f => [f, (current as any)[f]])),
                    newData: Object.fromEntries(addrFields.map(f => [f, (updated as any)[f]])),
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
