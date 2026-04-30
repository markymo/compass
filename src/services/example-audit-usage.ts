import prisma from "@/lib/prisma";
import { logAudit } from "./audit";

/**
 * Example A: Updating a Person's Name
 */
export async function updatePersonName(
  personId: string, 
  newFirstName: string, 
  newLastName: string, 
  actorUserId: string
) {
  // We wrap the read + update + log in a transaction to ensure atomic execution.
  return await prisma.$transaction(async (tx: any) => {
    // 1. Read the current record
    const currentPerson = await tx.person.findUniqueOrThrow({
      where: { id: personId },
    });

    // 2. Perform the update
    const updatedPerson = await tx.person.update({
      where: { id: personId },
      data: {
        firstName: newFirstName,
        lastName: newLastName,
      },
    });

    // 3. Write the audit log using the helper
    await logAudit(tx, {
      entityType: "Person",
      entityId: personId,
      action: "UPDATE",
      changedFields: ["firstName", "lastName"],
      oldData: {
        firstName: currentPerson.firstName,
        lastName: currentPerson.lastName,
      },
      newData: {
        firstName: updatedPerson.firstName,
        lastName: updatedPerson.lastName,
      },
      actorUserId,
      sourceType: "UI",
    });

    return updatedPerson;
  });
}

/**
 * Example B: Ending a Relationship (Graph Edge)
 */
export async function endRelationship(
  edgeId: string,
  actorUserId: string
) {
  return await prisma.$transaction(async (tx: any) => {
    const currentEdge = await tx.clientLEGraphEdge.findUniqueOrThrow({
      where: { id: edgeId },
    });

    const updatedEdge = await tx.clientLEGraphEdge.update({
      where: { id: edgeId },
      data: {
        isActive: false,
        ceasedOn: new Date(),
      },
    });

    await logAudit(tx, {
      entityType: "Relationship",
      entityId: edgeId,
      action: "END",
      changedFields: ["isActive", "ceasedOn"],
      oldData: {
        isActive: currentEdge.isActive,
        ceasedOn: currentEdge.ceasedOn,
      },
      newData: {
        isActive: updatedEdge.isActive,
        ceasedOn: updatedEdge.ceasedOn,
      },
      actorUserId,
      sourceType: "UI",
    });

    return updatedEdge;
  });
}
