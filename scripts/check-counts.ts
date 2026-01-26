
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Checking Engagement Counts ---')

    // Find limits / sample data
    const allEngagements = await prisma.fIEngagement.findMany({
        select: {
            id: true,
            isDeleted: true,
            status: true,
            org: { select: { name: true } },
            clientLE: { select: { name: true } }
        }
    })

    console.log(`Total Engagements in DB: ${allEngagements.length}`)

    const active = allEngagements.filter(e => !e.isDeleted)
    const deleted = allEngagements.filter(e => e.isDeleted)

    console.log(`Active: ${active.length}`)
    console.log(`Deleted: ${deleted.length}`)

    console.log('\n--- Active Engagements ---')
    active.forEach(e => {
        console.log(`- ${e.org.name} (Client: ${e.clientLE.name}) [Status: ${e.status}]`)
    })

    console.log('\n--- Deleted Engagements ---')
    deleted.forEach(e => {
        console.log(`- ${e.org.name} (Client: ${e.clientLE.name})`)
    })
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
