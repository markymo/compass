
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Checking prisma.usageLog...')
    if (prisma.usageLog) {
        console.log('SUCCESS: prisma.usageLog exists')
        const count = await prisma.usageLog.count()
        console.log(`Count: ${count}`)
    } else {
        console.error('FAILURE: prisma.usageLog is undefined')
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
