// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Demo Actors...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- ORGANIZATIONS ---
    let acme = await prisma.organization.findFirst({ where: { name: 'Acme Hedge Fund' } });
    if (!acme) {
        console.log('Creating Acme Hedge Fund...');
        acme = await prisma.organization.create({
            data: {
                name: 'Acme Hedge Fund',
                types: ['CLIENT'],
                domain: 'acme.com',
                status: 'ACTIVE'
            }
        });
    }

    let gsib = await prisma.organization.findFirst({ where: { name: 'G-SIB Bank' } });
    if (!gsib) {
        console.log('Creating G-SIB Bank...');
        gsib = await prisma.organization.create({
            data: {
                name: 'G-SIB Bank',
                types: ['FI'],
                domain: 'gsib.com',
                status: 'ACTIVE'
            }
        });
    }

    if (!acme || !gsib) {
        console.error('Failed to resolve organizations.');
        return;
    }

    // --- USERS ---

    // 1. Alice (Client Admin)
    const alice = await prisma.user.upsert({
        where: { email: 'demo.alice@example.com' },
        update: {
            isDemoActor: true,
            password: passwordHash,
            name: 'Alice Admin (Demo)'
        },
        create: {
            email: 'demo.alice@example.com',
            name: 'Alice Admin (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });

    // Alice Membership
    let aliceMember = await prisma.membership.findFirst({
        where: {
            userId: alice.id,
            organizationId: acme.id,
            clientLEId: null
        }
    });

    if (!aliceMember) {
        await prisma.membership.create({
            data: {
                userId: alice.id,
                organizationId: acme.id,
                role: 'ADMIN',
                clientLEId: null // Explicit null for creation
            }
        });
    } else {
        await prisma.membership.update({
            where: { id: aliceMember.id },
            data: { role: 'ADMIN' }
        });
    }
    console.log('Seeded Alice (Acme Admin)');

    // 2. Bob (FI Lead)
    const bob = await prisma.user.upsert({
        where: { email: 'demo.bob@example.com' },
        update: {
            isDemoActor: true,
            password: passwordHash,
            name: 'Bob Banker (Demo)'
        },
        create: {
            email: 'demo.bob@example.com',
            name: 'Bob Banker (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });

    // Bob Membership
    let bobMember = await prisma.membership.findFirst({
        where: {
            userId: bob.id,
            organizationId: gsib.id,
            clientLEId: null
        }
    });

    if (!bobMember) {
        await prisma.membership.create({
            data: {
                userId: bob.id,
                organizationId: gsib.id,
                role: 'ADMIN',
                clientLEId: null
            }
        });
    } else {
        await prisma.membership.update({
            where: { id: bobMember.id },
            data: { role: 'ADMIN' }
        });
    }
    console.log('Seeded Bob (G-SIB Admin)');

    // 3. Charlie (Consultant)
    // Charlie is external, maybe validly part of Acme as a 'Contributor' or similar?
    // Or just a member. Let's make him a member of Acme for now.
    const charlie = await prisma.user.upsert({
        where: { email: 'demo.charlie@example.com' },
        update: {
            isDemoActor: true,
            password: passwordHash,
            name: 'Charlie Consultant (Demo)'
        },
        create: {
            email: 'demo.charlie@example.com',
            name: 'Charlie Consultant (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });

    // Charlie Membership (Member Role)
    let charlieMember = await prisma.membership.findFirst({
        where: {
            userId: charlie.id,
            organizationId: acme.id,
            clientLEId: null
        }
    });

    if (!charlieMember) {
        await prisma.membership.create({
            data: {
                userId: charlie.id,
                organizationId: acme.id,
                role: 'MEMBER',
                clientLEId: null
            }
        });
    } else {
        await prisma.membership.update({
            where: { id: charlieMember.id },
            data: { role: 'MEMBER' }
        });
    }
    console.log('Seeded Charlie (Acme Member)');

    console.log('Demo Actors Seeded Successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
