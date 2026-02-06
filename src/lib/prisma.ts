import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    // In development, Neon can get exhausted by hot-reload connections. 
    // Usually connection_limit=1 in the connection string helps, but let's just log init.
    // console.log("Initializing new PrismaClient..."); 
    // Triggering client reload...
    return new PrismaClient()
}

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
