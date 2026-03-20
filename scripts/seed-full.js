const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { FIELD_DEFINITIONS } = require('../src/domain/kyc/FieldDefinitions');
const { FIELD_GROUPS } = require('../src/domain/kyc/FieldGroups');

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Refreshed Full Authoritative Seed (JS)...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- 1. SEED ORGANIZATIONS ---
    console.log('🏢 Seeding Organizations...');

    async function ensureOrg(name, types, domain) {
        let org = await prisma.organization.findFirst({ where: { name } });
        if (!org) {
            org = await prisma.organization.create({
                data: { name, types, domain, status: 'ACTIVE' }
            });
        }
        return org;
    }

    const systemOrg = await ensureOrg('Compass System', ['SYSTEM'], 'compass.ai');
    const gsib = await ensureOrg('G-SIB Bank', ['FI', 'SUPPLIER'], 'gsib.com');
    const barclays = await ensureOrg('Barclays', ['FI', 'SUPPLIER'], 'barclays.com');
    const natwest = await ensureOrg('NatWest Group', ['FI', 'SUPPLIER'], 'natwest.com');
    const rabobank = await ensureOrg('Rabobank', ['FI', 'SUPPLIER'], 'rabobank.com');
    const acme = await ensureOrg('Acme Hedge Fund', ['CLIENT'], 'acme.com');
    const orsted = await ensureOrg('Orsted', ['CLIENT'], 'orsted.com');
    const startups = await ensureOrg('Startup Fintech', ['CLIENT'], 'fintech.com');
    const riskbridge = await ensureOrg('Riskbridge', ['FI', 'SUPPLIER'], 'riskbridge.com');

    // --- 2. SEED USERS ---
    console.log('👤 Seeding Users...');

    async function ensureUser(email, name, isDemo = true) {
        return await prisma.user.upsert({
            where: { email },
            update: { name, password: passwordHash, isDemoActor: isDemo },
            create: { email, name, password: passwordHash, isDemoActor: isDemo }
        });
    }

    const mark = await ensureUser('mark@30gram6.com', 'Mark Lissaman', false);
    const rob = await ensureUser('rdorntonduff@riskbridge.com', 'Rob Dornton-Duff', false);
    const alice = await ensureUser('demo.alice@example.com', 'Alice Admin (Demo)');
    const bob = await ensureUser('demo.bob@example.com', 'Bob Banker (Demo)');

    // --- 3. SEED MEMBERSHIPS ---
    console.log('🔑 Seeding Memberships...');

    async function ensureMembership(userId, orgId, role) {
        let member = await prisma.membership.findFirst({
            where: { userId, organizationId: orgId, clientLEId: null }
        });
        if (!member) {
            await prisma.membership.create({
                data: { userId, organizationId: orgId, role, clientLEId: null }
            });
        }
    }

    // System Admins
    await ensureMembership(mark.id, systemOrg.id, 'SYSTEM_ADMIN');
    await ensureMembership(rob.id, systemOrg.id, 'SYSTEM_ADMIN');

    // Orga Admins
    const admins = [mark, rob, alice];
    const orgs = [gsib, barclays, natwest, rabobank, acme, orsted, riskbridge];
    
    for (const org of orgs) {
        for (const admin of admins) {
            await ensureMembership(admin.id, org.id, 'ORG_ADMIN');
        }
    }

    // --- 4. SEED MASTER SCHEMA ---
    console.log('🌱 Seeding Master Field Definitions...');
    for (const key of Object.keys(FIELD_DEFINITIONS)) {
        const fieldNo = Number(key);
        const def = FIELD_DEFINITIONS[fieldNo];
        await prisma.masterFieldDefinition.upsert({
            where: { fieldNo },
            update: {
                fieldName: def.fieldName,
                appDataType: def.appDataType,
                isMultiValue: def.isMultiValue,
                options: def.options || [],
                notes: def.notes,
                category: def.model,
                modelField: def.field,
                isActive: true,
            },
            create: {
                fieldNo,
                fieldName: def.fieldName,
                appDataType: def.appDataType,
                isMultiValue: def.isMultiValue,
                options: def.options || [],
                notes: def.notes,
                category: def.model,
                modelField: def.field,
                isActive: true,
                order: fieldNo * 10,
            }
        });
    }

    // --- 5. SEED MASTER FIELD GROUPS ---
    console.log('📦 Seeding Field Groups...');
    for (const key of Object.keys(FIELD_GROUPS)) {
        const group = FIELD_GROUPS[key];
        const dbGroup = await prisma.masterFieldGroup.upsert({
            where: { key },
            update: { label: group.label, description: group.description, isActive: true },
            create: { key, label: group.label, description: group.description, isActive: true }
        });

        for (let i = 0; i < group.fieldNos.length; i++) {
            const fieldNo = group.fieldNos[i];
            await prisma.masterFieldGroupItem.upsert({
                where: { groupId_fieldNo: { groupId: dbGroup.id, fieldNo } },
                update: { order: i * 10 },
                create: { groupId: dbGroup.id, fieldNo, order: i * 10 }
            });
        }
    }

    // --- 5.5. SEED SYSTEM CATEGORIES ---
    console.log('📂 Seeding System Categories...');
    const normalize = (name) =>
        name.trim().toLowerCase().replace(/[\s\W]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const categoryNames = Array.from(
        new Set(Object.values(FIELD_DEFINITIONS).map(d => d.model).filter(Boolean))
    );

    const categoryMap = new Map(); // displayName -> id

    for (let i = 0; i < categoryNames.length; i++) {
        const name = categoryNames[i];
        const key = normalize(name);
        if (!key) continue;

        const cat = await prisma.masterDataCategory.upsert({
            where: { key },
            update: { displayName: name },
            create: { key, displayName: name, order: i }
        });
        categoryMap.set(name, cat.id);
    }

    // Link fields to their categories
    for (const fieldNoStr of Object.keys(FIELD_DEFINITIONS)) {
        const fieldNo = Number(fieldNoStr);
        const def = FIELD_DEFINITIONS[fieldNo];
        const catId = categoryMap.get(def.model);
        if (catId) {
            await prisma.masterFieldDefinition.update({
                where: { fieldNo },
                data: { categoryId: catId, categoryLabel: def.model }
            });
        }
    }

    // --- 6. SEED LEGAL ENTITIES & CLIENT LEs ---
    console.log('🏛️ Seeding Core Legal Entities...');

    async function ensureLE(ref, name, ownerOrg, details = {}) {
        let le = await prisma.legalEntity.upsert({
            where: { reference: ref },
            update: {},
            create: { reference: ref }
        });

        let clientLE = await prisma.clientLE.findFirst({ where: { name } });
        if (!clientLE) {
            clientLE = await prisma.clientLE.create({
                data: {
                    name,
                    jurisdiction: details.jurisdiction || 'United Kingdom',
                    status: 'ACTIVE',
                    legalEntityId: le.id,
                    lei: details.lei || null
                }
            });
        }

        // Owner link
        await prisma.clientLEOwner.upsert({
            where: { id: clientLE.id + "_" + ownerOrg.id },
            update: {},
            create: {
                id: clientLE.id + "_" + ownerOrg.id,
                clientLEId: clientLE.id,
                partyId: ownerOrg.id,
                startAt: new Date()
            }
        }).catch(() => {
            // Uniqueness fail usually means already exists
        });

        return { le, clientLE };
    }

    const leAcme = await ensureLE('LE-ACME-001', 'Acme Global Alpha Ltd', acme, { lei: '549300H86P0S9N8P8H8H' });
    const leWales = await ensureLE('REF-WALES-001', 'Keep Wales Tidy', acme, { jurisdiction: 'United Kingdom' });
    const leHornsea = await ensureLE('REF-HORNSEA-002', 'Hornsea 2', orsted, { jurisdiction: 'United Kingdom' });
    const leSSE = await ensureLE('REF-SSE-001', 'SSE Hornsea Ltd', orsted, { jurisdiction: 'United Kingdom' });
    const leGarbet = await ensureLE('REF-GARBET-001', 'GARBET WIND FARM LLP', orsted, { jurisdiction: 'United Kingdom' });

    // --- 7. SEED ENGAGEMENTS & QUESTIONNAIRES ---
    console.log('🤝 Seeding Engagements & Questionnaires...');

    async function ensureEngagement(fiOrg, clientLE, status = 'CONNECTED') {
        return await prisma.fIEngagement.upsert({
            where: { fiOrgId_clientLEId: { fiOrgId: fiOrg.id, clientLEId: clientLE.id } },
            update: { status },
            create: { fiOrgId: fiOrg.id, clientLEId: clientLE.id, status }
        });
    }

    const engWales = await ensureEngagement(gsib, leWales.clientLE);
    const engAcme = await ensureEngagement(gsib, leAcme.clientLE);
    const engHornsea = await ensureEngagement(natwest, leHornsea.clientLE, 'PREPARATION');
    
    // Questionnaires
    async function ensureQuestionnaire(fiOrg, eng, name, questions) {
        let q = await prisma.questionnaire.findFirst({ where: { name, fiEngagementId: eng.id } });
        if (!q) {
            q = await prisma.questionnaire.create({
                data: {
                    name,
                    fiOrgId: fiOrg.id,
                    fiEngagementId: eng.id,
                    status: 'ACTIVE',
                    questions: {
                        create: questions.map((text, i) => ({
                            text,
                            order: i + 1,
                            status: 'DRAFT'
                        }))
                    }
                }
            });
        }
        return q;
    }

    await ensureQuestionnaire(gsib, engWales, 'Due Diligence 2026', [
        'What is the legal name of the entity?',
        'What is the registered address of the entity?'
    ]);

    await ensureQuestionnaire(gsib, engWales, 'test questionnaire RDD3', [
        'Question 1',
        'Question 2',
        'Question 3'
    ]);

    // --- 8. SEED REGISTRY AUTHORITIES ---
    console.log('🏛️ Seeding Registry Authorities...');
    const auths = [
        { id: "RA000585", registryKey: "GB_COMPANIES_HOUSE", name: "UK Companies House", countryCode: "GB" },
        { id: "RA000589", registryKey: "CHARITY_COMMISSION", name: "Charity Commission for England and Wales", countryCode: "GB" }
    ];

    for (const auth of auths) {
        await prisma.registryAuthority.upsert({
            where: { id: auth.id },
            update: auth,
            create: auth
        });
    }

    console.log('✅ Refreshed Seed Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
