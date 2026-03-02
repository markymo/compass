import prisma from "../src/lib/prisma";

async function main() {
    try {
        const counts = await Promise.all([
            prisma.user.count(),
            prisma.organization.count(),
            prisma.clientLE.count(),
            prisma.question.count(),
            prisma.masterFieldDefinition.count()
        ]);
        console.log({
            users: counts[0],
            orgs: counts[1],
            les: counts[2],
            questions: counts[3],
            fieldDefs: counts[4]
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
