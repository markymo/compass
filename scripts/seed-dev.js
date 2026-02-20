
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Unified World Builder (Idempotent)...');

    // Check if we are connected to the right DB
    // (Optional safety check)

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- 1. Organizations ---
    console.log('\n--- 1. Organizations ---');
    const systemOrg = await ensureOrg('ONpro System', 'SYSTEM', 'onpro.tech');
    const acme = await ensureOrg('Acme Hedge Fund', 'CLIENT', 'acme.com');
    const gsib = await ensureOrg('G-SIB Bank', 'FI', 'gsib.com');

    // Load external FIs from CSV if available
    await seedFinancialInstitutionsCSV();

    // --- 2. Users ---
    console.log('\n--- 2. Users ---');
    const mark = await ensureUser('mark@30gram6.com', 'Mark Lissaman', passwordHash, false);
    const rob = await ensureUser('ddortonduff@riskbridge.com', 'Rob Dornton-Duff', passwordHash, false);
    const alice = await ensureUser('demo.alice@example.com', 'Alice Admin (Demo)', passwordHash, true);
    const bob = await ensureUser('demo.bob@example.com', 'Bob Banker (Demo)', passwordHash, true);
    const charlie = await ensureUser('demo.charlie@example.com', 'Charlie Consultant (Demo)', passwordHash, true);

    // --- 3. Memberships (Party Level) ---
    console.log('\n--- 3. Memberships ---');
    // System Admins
    await ensureMembership(mark.id, systemOrg.id, 'ORG_ADMIN');
    await ensureMembership(rob.id, systemOrg.id, 'ORG_ADMIN');

    // Mark -> Admin at Acme (and effectively System Admin via DB check)
    await ensureMembership(mark.id, acme.id, 'ORG_ADMIN');

    // Alice -> Admin at Acme
    await ensureMembership(alice.id, acme.id, 'ORG_ADMIN');

    // Bob -> Admin at G-SIB
    await ensureMembership(bob.id, gsib.id, 'ORG_ADMIN');

    // Charlie -> Member at Acme
    await ensureMembership(charlie.id, acme.id, 'ORG_MEMBER');

    // --- 4. Client Legal Entities (Workspaces) ---
    console.log('\n--- 4. Client Legal Entities ---');
    const fund1 = await ensureClientLE('Acme Global Fund I', acme.id, 'Cayman Islands');
    const fund2 = await ensureClientLE('Acme European Credit Fund', acme.id, 'Luxembourg');
    const spv1 = await ensureClientLE('Acme Trading SPV Ltd', acme.id, 'UK');

    // Orsted
    const orsted = await ensureOrg('Orsted', 'CLIENT', 'orsted.com');
    await ensureClientLE('Hornsea 4', orsted.id, 'UK');
    await ensureClientLE('Hornsea 3', orsted.id, 'UK');
    await ensureClientLE('Greater Changhua 2b', orsted.id, 'Taiwan');
    await ensureClientLE('Ocean Wind 1', orsted.id, 'USA');
    await ensureClientLE('South Fork Wind', orsted.id, 'USA');
    await ensureClientLE('Greater Changhua 2a', orsted.id, 'Taiwan');
    await ensureClientLE('Greater Changhua 1', orsted.id, 'Taiwan');
    await ensureClientLE('Borssele 1 & 2', orsted.id, 'Netherlands');
    await ensureClientLE('Gode Wind 3', orsted.id, 'Germany');
    await ensureClientLE('Hornsea 2', orsted.id, 'UK');

    // Orsted Memberships
    await ensureMembership(mark.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(rob.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(alice.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(charlie.id, orsted.id, 'ORG_MEMBER');

    // --- 5. Relationships (FIEngagements) ---
    console.log('\n--- 5. Relationships (FIEngagements) ---');
    // Fund 1 <-> G-SIB (Connected)
    const eng1 = await ensureEngagement(fund1.id, gsib.id, 'CONNECTED');
    // Fund 2 <-> G-SIB (Preparation)
    const eng2 = await ensureEngagement(fund2.id, gsib.id, 'PREPARATION');

    // --- 6. Supplier Scenarios ---
    console.log('\n--- 6. Supplier Scenarios ---');
    // Alice invites Startup Fintech to Fund 1 (Eng 1)
    await ensureInvitation(eng1.id, 'start.up@fintech.com', alice.id);

    console.log('\n✅ Seeding Complete.');
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function ensureOrg(name, type, domain) {
    let org = await prisma.organization.findFirst({ where: { name } });
    if (!org) {
        org = await prisma.organization.create({
            data: { name, types: [type], domain, status: 'ACTIVE' }
        });
        console.log(`Created Org: ${name}`);
    } else {
        // Ensure type exists
        if (!org.types.includes(type)) {
            await prisma.organization.update({
                where: { id: org.id },
                data: { types: { push: type } }
            });
            console.log(`Updated Org ${name} with type ${type}`);
        }
    }
    return org;
}

async function ensureUser(email, name, hash, isDemo) {
    const user = await prisma.user.upsert({
        where: { email },
        update: { password: hash, name, isDemoActor: isDemo },
        create: { email, name, password: hash, isDemoActor: isDemo }
    });
    console.log(`Ensured User: ${email}`);
    return user;
}

async function ensureMembership(userId, orgId, role) {
    const member = await prisma.membership.findFirst({
        where: { userId, organizationId: orgId, clientLEId: null }
    });

    if (member) {
        if (member.role !== role) {
            await prisma.membership.update({ where: { id: member.id }, data: { role } });
            console.log(`Updated membership to ${role}`);
        }
    } else {
        await prisma.membership.create({
            data: { userId, organizationId: orgId, role, clientLEId: null }
        });
        console.log(`Created membership: ${role}`);
    }
}

async function ensureClientLE(name, ownerOrgId, jurisdiction) {
    let le = await prisma.clientLE.findFirst({ where: { name } });
    if (!le) {
        le = await prisma.clientLE.create({
            data: { name, jurisdiction, status: 'ACTIVE' }
        });
        console.log(`Created LE: ${name}`);
    }

    // Ensure Owner Link
    const owner = await prisma.clientLEOwner.findFirst({
        where: { clientLEId: le.id, partyId: ownerOrgId, endAt: null }
    });
    if (!owner) {
        await prisma.clientLEOwner.create({
            data: { clientLEId: le.id, partyId: ownerOrgId }
        });
        console.log(` -> Linked owner: ${ownerOrgId}`);
    }
    return le;
}

async function ensureEngagement(clientLEId, fiOrgId, status) {
    let eng = await prisma.fIEngagement.findUnique({
        where: { fiOrgId_clientLEId: { fiOrgId, clientLEId } }
    });

    if (!eng) {
        eng = await prisma.fIEngagement.create({
            data: { fiOrgId, clientLEId, status }
        });
        console.log(`Created Engagement: ${status}`);
    } else if (eng.status !== status) {
        eng = await prisma.fIEngagement.update({
            where: { id: eng.id },
            data: { status }
        });
        console.log(`Updated Engagement Status: ${status}`);
    }
    return eng;
}

async function ensureInvitation(fiEngagementId, sentToEmail, createdByUserId) {
    const existing = await prisma.invitation.findFirst({
        where: { fiEngagementId, sentToEmail, usedAt: null, revokedAt: null }
    });

    if (!existing) {
        const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
        await prisma.invitation.create({
            data: {
                fiEngagementId,
                sentToEmail,
                role: 'Supplier Contact',
                tokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                createdByUserId
            }
        });
        console.log(`Created Invitation for ${sentToEmail}`);
    } else {
        console.log(`Invitation already pending for ${sentToEmail}`);
    }
}

async function seedFinancialInstitutionsCSV() {
    const csvPath = path.join(process.cwd(), 'docs/data/FinancialInstitutions.csv');
    if (!fs.existsSync(csvPath)) return;

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cols = matches.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        if (cols.length < 2) continue;
        const [bankName, domain, country, description] = cols;
        const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

        try {
            await ensureOrg(bankName, 'FI', domain);
            count++;
        } catch (e) {
            // Ignore duplicates or errors
        }
    }
    console.log(`Processed ${count} FIs from CSV.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
