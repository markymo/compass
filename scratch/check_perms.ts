
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const qId = 'a3055768-ef28-44a2-80e4-dd4d4f1df04b';
    const q = await prisma.questionnaire.findUnique({
        where: { id: qId },
        select: { fiOrgId: true, fiEngagementId: true, name: true }
    });
    console.log('Questionnaire:', q);

    if (q) {
        const memberships = await prisma.membership.findMany({
            where: {
                OR: [
                    { organizationId: q.fiOrgId },
                    { fiEngagementId: q.fiEngagementId }
                ]
            },
            include: { user: true }
        });
        console.log('Memberships for this context:', memberships.map(m => ({
            email: m.user.email,
            role: m.role,
            orgId: m.organizationId,
            leId: m.clientLEId,
            engId: m.fiEngagementId
        })));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
