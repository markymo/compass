import { Prisma } from "@prisma/client";

/**
 * Minimal audit logging helper.
 * 
 * @param tx - The Prisma Transaction client. MUST be used within a $transaction.
 * @param params - The audit details.
 */
export async function logAudit(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "END";
    changedFields: string[];
    oldData?: any;
    newData?: any;
    actorUserId?: string;
    sourceType?: "UI" | "IMPORT" | "SYSTEM";
    correlationId?: string;
  }
) {
  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changedFields: params.changedFields,
      // Stringify/Parse isn't strictly necessary with Prisma JSON types if you pass objects,
      // but if you have undefined values or dates, standardizing the JSON is safer.
      oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
      newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
      actorUserId: params.actorUserId,
      sourceType: params.sourceType || "UI",
      correlationId: params.correlationId,
    },
  });
}
