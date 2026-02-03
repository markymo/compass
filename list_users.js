
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    });
    console.log("Total Users:", users.length);
    console.table(users);
}

listUsers()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
