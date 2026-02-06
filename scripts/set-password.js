const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node scripts/set-password.js <email> <new-password>');
        process.exit(1);
    }

    const email = args[0];
    const password = args[1];

    console.log(`Hashing password for ${email}...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        });
        console.log(`✅ Success! Password updated for user: ${user.email}`);
    } catch (error) { // Catch if user not found
        if (error.code === 'P2025') {
            console.error(`❌ Error: User with email '${email}' not found.`);
        } else {
            console.error('❌ Database error:', error);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
