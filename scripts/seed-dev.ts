// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Unified Seeder (Idempotent)...');

    // --- 1. Reference Data (Financial Institutions) ---
    console.log('\n--- Seeding Financial Institutions ---');
    await seedFinancialInstitutions();

    // --- 2. Demo Tenants & Users ---
    console.log('\n--- Seeding Demo Tenants & Users ---');
    await seedDemoTenants();

    console.log('\n✅ Seeding Complete.');
}

async function seedFinancialInstitutions() {
    const csvPath = path.join(process.cwd(), 'docs/data/FinancialInstitutions.csv');

    if (!fs.existsSync(csvPath)) {
        console.warn(`⚠️ File not found: ${csvPath}. Skipping FI seed.`);
        return;
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    let successCount = 0;

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parse
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const parseCSVLine = (text) => {
            // ... existing logic adaptation ...
            const result = [];
            let current = '';
            let inQuote = false;
            for (let j = 0; j < text.length; j++) {
                const char = text[j];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) { result.push(current); current = ''; }
                else current += char;
            }
            result.push(current);
            return result.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        };

        const cols = parseCSVLine(line);
        if (cols.length < 2) continue;

        const [bankName, domain, country, description] = cols;
        const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

        try {
            // Upsert Logic
            const existing = await prisma.organization.findFirst({ where: { name: bankName } });

            const data = {
                name: bankName,
                domain: domain,
                description: description || `Headquarters: ${country}`,
                logoUrl: logoUrl,
                types: ['FI'] // Default
            };

            if (existing) {
                const currentTypes = existing.types || [];
                const newTypes = currentTypes.includes('FI') ? currentTypes : [...currentTypes, 'FI'];
                await prisma.organization.update({
                    where: { id: existing.id },
                    data: { ...data, types: newTypes }
                });
            } else {
                await prisma.organization.create({
                    data: { ...data, types: ['FI'] }
                });
            }
            successCount++;
        } catch (e) {
            console.error(`Failed to process ${bankName}:`, e.message);
        }
    }
    console.log(`Processed ${successCount} FIs.`);
}

async function seedDemoTenants() {
    const passwordHash = await bcrypt.hash('password123', 10);

    // --- Organizations ---
    // 1. Acme Hedge Fund (Client)
    let acme = await prisma.organization.findFirst({ where: { name: 'Acme Hedge Fund' } });
    if (acme) {
        acme = await prisma.organization.update({
            where: { id: acme.id },
            data: { types: ['CLIENT'], domain: 'acme.com', status: 'ACTIVE' }
        });
    } else {
        acme = await prisma.organization.create({
            data: {
                name: 'Acme Hedge Fund',
                types: ['CLIENT'],
                domain: 'acme.com',
                status: 'ACTIVE'
            }
        });
    }

    // 2. G-SIB Bank (FI)
    let gsib = await prisma.organization.findFirst({ where: { name: 'G-SIB Bank' } });
    if (gsib) {
        gsib = await prisma.organization.update({
            where: { id: gsib.id },
            data: { types: ['FI'], domain: 'gsib.com', status: 'ACTIVE' }
        });
    } else {
        gsib = await prisma.organization.create({
            data: {
                name: 'G-SIB Bank',
                types: ['FI'],
                domain: 'gsib.com',
                status: 'ACTIVE'
            }
        });
    }

    // --- Users ---
    // 1. Alice (Client Admin)
    const alice = await prisma.user.upsert({
        where: { email: 'demo.alice@example.com' },
        update: { isDemoActor: true, password: passwordHash, name: 'Alice Admin (Demo)' },
        create: {
            email: 'demo.alice@example.com',
            name: 'Alice Admin (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });
    await ensureMembership(alice.id, acme.id, 'ORG_ADMIN');

    // 2. Bob (FI Lead)
    const bob = await prisma.user.upsert({
        where: { email: 'demo.bob@example.com' },
        update: { isDemoActor: true, password: passwordHash, name: 'Bob Banker (Demo)' },
        create: {
            email: 'demo.bob@example.com',
            name: 'Bob Banker (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });
    await ensureMembership(bob.id, gsib.id, 'ORG_ADMIN');

    // 3. Charlie (Member)
    const charlie = await prisma.user.upsert({
        where: { email: 'demo.charlie@example.com' },
        update: { isDemoActor: true, password: passwordHash, name: 'Charlie Consultant (Demo)' },
        create: {
            email: 'demo.charlie@example.com',
            name: 'Charlie Consultant (Demo)',
            password: passwordHash,
            isDemoActor: true
        }
    });
    await ensureMembership(charlie.id, acme.id, 'ORG_MEMBER');
}

async function ensureMembership(userId, orgId, role) {
    const member = await prisma.membership.findFirst({
        where: { userId, organizationId: orgId, clientLEId: null }
    });

    if (member) {
        if (member.role !== role) {
            await prisma.membership.update({ where: { id: member.id }, data: { role } });
            console.log(`Updated membership for user ${userId} to ${role}`);
        }
    } else {
        await prisma.membership.create({
            data: { userId, organizationId: orgId, role, clientLEId: null }
        });
        console.log(`Created membership for user ${userId} as ${role}`);
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
