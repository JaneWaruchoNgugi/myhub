import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Records an audit entry for an important financial change. Call inside the same DB transaction. */
export async function audit(tx: Tx, userId: string, action: string, entity: string, entityId: string | null, details?: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { userId, action, entity, entityId, details } });
}
