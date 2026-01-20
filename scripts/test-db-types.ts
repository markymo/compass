
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Testing Prisma Types...')

    // 1. Test Questionnaire Types
    try {
        const q = await prisma.questionnaire.findFirst({
            where: { isDeleted: false }
        })
        console.log('Questionnaire.isDeleted query: OK')
    } catch (e) {
        console.error('Questionnaire.isDeleted query: FAILED', e)
    }

    // 2. Test Engagement Include Types
    try {
        const e = await prisma.fIEngagement.findFirst({
            include: {
                questionnaires: {
                    where: { isDeleted: false }
                },
                sharedDocuments: {
                    where: { isDeleted: false }
                },
                clientLE: true,
                org: true
            }
        })

        if (e) {
            // Verify properties verify access
            const _q = e.questionnaires
            const _d = e.sharedDocuments
            const _l = e.clientLE
            const _o = e.org
            console.log('Engagement Includes Access: OK')
        } else {
            console.log('Engagement Includes Access: OK (No records found, but compiled)')
        }

    } catch (e) {
        console.error('Engagement Include query: FAILED', e)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
