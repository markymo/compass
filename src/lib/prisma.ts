import { PrismaClient } from '@prisma/client';
import { legacyAuditExtension } from './prisma-audit';

const prismaClientSingleton = () => {
    return new PrismaClient().$extends(legacyAuditExtension);
}

declare const globalThis: {
    prismaGlobal1: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = (globalThis as any).prismaGlobal1 || prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') (globalThis as any).prismaGlobal1 = prisma
