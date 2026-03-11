// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FIELD_DEFINITIONS } from '../src/domain/kyc/FieldDefinitions';
import { FIELD_GROUPS } from '../src/domain/kyc/FieldGroups';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Full Authoritative Seed...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- 1. SEED ORGANIZATIONS ---
    console.log('🏢 Seeding Organizations...');

    async function ensureOrg(name: string, types: string[], domain: string) {
        let org = await prisma.organization.findFirst({ where: { name } });
        if (!org) {
            org = await prisma.organization.create({
                data: { name, types, domain, status: 'ACTIVE' }
            });
        }
        return org;
    }

    const acme = await ensureOrg('Acme Hedge Fund', ['CLIENT'], 'acme.com');
    const gsib = await ensureOrg('G-SIB Bank', ['FI', 'SUPPLIER'], 'gsib.com');
    const systemOrg = await ensureOrg('Compass System', ['SYSTEM'], 'compass.ai');
    const barclays = await ensureOrg('Barclays', ['FI', 'SUPPLIER'], 'barclays.com');
    const natwest = await ensureOrg('NatWest Group', ['FI', 'SUPPLIER'], 'natwest.com');
    const rabobank = await ensureOrg('Rabobank', ['FI', 'SUPPLIER'], 'rabobank.com');
    const fintech = await ensureOrg('Startup Fintech', ['CLIENT'], 'fintech.com');
    const legal = await ensureOrg('Acme Legal LLP', ['LAW_FIRM', 'SUPPLIER'], 'acme-legal.com');
    const riskbridge = await ensureOrg('Riskbridge', ['FI', 'SUPPLIER'], 'riskbridge.com');
    const orsted = await ensureOrg('Orsted', ['CLIENT'], 'orsted.com');

    // --- 2. SEED USERS ---
    console.log('👤 Seeding Users...');

    async function ensureUser(email: string, name: string, isDemo: boolean = true) {
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
    const charlie = await ensureUser('demo.charlie@example.com', 'Charlie Consultant (Demo)');

    // --- 3. SEED MEMBERSHIPS ---
    console.log('🔑 Seeding Memberships...');

    async function ensureMembership(userId: string, orgId: string, role: string) {
        let member = await prisma.membership.findFirst({
            where: { userId, organizationId: orgId, clientLEId: null }
        });
        if (!member) {
            await prisma.membership.create({
                data: { userId, organizationId: orgId, role, clientLEId: null }
            });
        } else if (member.role !== role) {
            await prisma.membership.update({
                where: { id: member.id },
                data: { role }
            });
        }
    }

    // System Admins
    await ensureMembership(mark.id, systemOrg.id, 'SYSTEM_ADMIN');
    await ensureMembership(rob.id, systemOrg.id, 'SYSTEM_ADMIN');

    // Acme Staff
    await ensureMembership(mark.id, acme.id, 'ORG_ADMIN');
    await ensureMembership(alice.id, acme.id, 'ORG_ADMIN');
    await ensureMembership(charlie.id, acme.id, 'ORG_MEMBER');

    // FI Staff
    await ensureMembership(bob.id, gsib.id, 'ORG_ADMIN');
    await ensureMembership(rob.id, riskbridge.id, 'ORG_ADMIN');

    // Orsted Staff
    await ensureMembership(mark.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(rob.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(alice.id, orsted.id, 'ORG_ADMIN');
    await ensureMembership(charlie.id, orsted.id, 'ORG_MEMBER');

    // --- 4. SEED MASTER SCHEMA (Field Definitions) ---
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
                options: (def as any).options || [],
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
                options: (def as any).options || [],
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

    // --- 6. SEED LEGAL ENTITY & CLAIMS ---
    console.log('🏛️ Seeding Sample Legal Entity & Claims...');
    const le = await prisma.legalEntity.upsert({
        where: { reference: 'LE-ACME-001' },
        update: {},
        create: { reference: 'LE-ACME-001' }
    });

    const clientLE = await prisma.clientLE.upsert({
        where: { id: '863ad8f2-b425-41b1-b1ef-840f15b7998a' }, // Stable ID for demo
        update: { name: 'Acme Global Alpha Ltd', legalEntityId: le.id },
        create: {
            id: '863ad8f2-b425-41b1-b1ef-840f15b7998a',
            name: 'Acme Global Alpha Ltd',
            jurisdiction: 'United Kingdom',
            legalEntityId: le.id,
            status: 'ACTIVE'
        }
    });

    // Owner link
    let ownerLink = await prisma.clientLEOwner.findFirst({
        where: { clientLEId: clientLE.id, partyId: acme.id }
    });
    if (!ownerLink) {
        await prisma.clientLEOwner.create({
            data: {
                clientLEId: clientLE.id,
                partyId: acme.id,
                startAt: new Date()
            }
        });
    }

    // Seed Claims (Authoritative Master Data)
    const claims = [
        { fieldNo: 3, valueText: 'Acme Global Alpha Ltd', sourceType: 'USER_INPUT' },
        { fieldNo: 2, valueText: '549300H86P0S9N8P8H8H', sourceType: 'GLEIF' },
        { fieldNo: 6, valueText: '123 Alpha Road', sourceType: 'USER_INPUT' },
        { fieldNo: 7, valueText: 'London', sourceType: 'USER_INPUT' },
        { fieldNo: 9, valueText: 'United Kingdom', sourceType: 'USER_INPUT' },
        { fieldNo: 10, valueText: 'EC2A 2BB', sourceType: 'USER_INPUT' },
        { fieldNo: 26, valueText: 'ACTIVE', sourceType: 'GLEIF' },
        { fieldNo: 27, valueDate: new Date('2015-01-01'), sourceType: 'GLEIF' },
    ];

    for (const c of claims) {
        await prisma.fieldClaim.create({
            data: {
                ...c,
                subjectLeId: le.id,
                status: 'VERIFIED',
                assertedAt: new Date()
            }
        });
    }

    // --- 7. SEED ENGAGEMENT ---
    console.log('🤝 Seeding FI Engagement...');
    const engagement = await prisma.fIEngagement.upsert({
        where: { fiOrgId_clientLEId: { fiOrgId: gsib.id, clientLEId: clientLE.id } },
        update: { status: 'CONNECTED' },
        create: {
            fiOrgId: gsib.id,
            clientLEId: clientLE.id,
            status: 'CONNECTED',
            isDeleted: false
        }
    });

    await prisma.questionnaire.deleteMany({
        where: {
            fiOrgId: gsib.id,
            fiEngagementId: engagement.id,
            name: 'Due Diligence 2026'
        }
    });

    const questionnaire = await prisma.questionnaire.create({
        data: {
            name: 'Due Diligence 2026',
            fiOrgId: gsib.id,
            fiEngagementId: engagement.id,
            status: 'DRAFT',
            questions: {
                create: [
                    {
                        text: 'What is the legal name of the entity?',
                        order: 1,
                        masterFieldNo: 3,
                        status: 'DRAFT'
                    },
                    {
                        text: 'What is the registered address of the entity?',
                        order: 2,
                        masterQuestionGroupId: 'REGISTERED_ADDRESS',
                        status: 'DRAFT'
                    }
                ]
            }
        }
    });

    // --- 8. SEED ORSTED PORTFOLIO ---
    console.log('⚡ Seeding Orsted Portfolio...');
    const orstedLEConfigs = [
        { name: 'Hornsea 4', jurisdiction: 'UK' },
        { name: 'Hornsea 3', jurisdiction: 'UK' },
        { name: 'Hornsea 2', jurisdiction: 'UK' },
        { name: 'Greater Changhua 2b', jurisdiction: 'Taiwan' },
        { name: 'Greater Changhua 2a', jurisdiction: 'Taiwan' },
        { name: 'Greater Changhua 1', jurisdiction: 'Taiwan' },
        { name: 'Ocean Wind 1', jurisdiction: 'USA' },
        { name: 'South Fork Wind', jurisdiction: 'USA' },
        { name: 'Borssele 1 & 2', jurisdiction: 'Netherlands' },
        { name: 'Gode Wind 3', jurisdiction: 'Germany' },
    ];

    for (const leConfig of orstedLEConfigs) {
        // Use findFirst -> create to avoid ID issues if they aren't marked unique at schema level (though usually ID is)
        // Find by name since that's our conceptual key for seed
        let le = await prisma.clientLE.findFirst({ where: { name: leConfig.name } });
        if (!le) {
            le = await prisma.clientLE.create({
                data: {
                    name: leConfig.name,
                    jurisdiction: leConfig.jurisdiction,
                    status: 'ACTIVE'
                }
            });
        }

        // Link to Orsted
        let link = await prisma.clientLEOwner.findFirst({
            where: { clientLEId: le.id, partyId: orsted.id }
        });
        if (!link) {
            await prisma.clientLEOwner.create({
                data: { clientLEId: le.id, partyId: orsted.id, startAt: new Date() }
            });
        }
    }

    // Engagements for Orsted
    async function ensureEng(leName: string, fiOrg: any, status: string = 'PREPARATION') {
        const le = await prisma.clientLE.findFirst({ where: { name: leName } });
        if (!le) return;

        await prisma.fIEngagement.upsert({
            where: { fiOrgId_clientLEId: { fiOrgId: fiOrg.id, clientLEId: le.id } },
            update: { status },
            create: { fiOrgId: fiOrg.id, clientLEId: le.id, status, isDeleted: false }
        });
    }

    await ensureEng('Hornsea 2', natwest, 'PREPARATION');
    await ensureEng('South Fork Wind', barclays, 'PREPARATION');
    await ensureEng('South Fork Wind', rabobank, 'PREPARATION');
    await ensureEng('Gode Wind 3', rabobank, 'PREPARATION');
    
    // --- 9. SEED REGISTRY AUTHORITIES ---
    console.log('🏛️ Seeding Registry Authorities...');
    const initialAuthorities = [
        {
            id: "RA000585",
            registryKey: "GB_COMPANIES_HOUSE",
            name: "Companies House",
            countryCode: "GB",
            jurisdiction: "UK",
            lookupStrategy: "LOCAL_ID",
            notes: "UK national registry for companies"
        }
    ];

    for (const auth of initialAuthorities) {
        await prisma.registryAuthority.upsert({
            where: { id: auth.id },
            update: auth,
            create: auth
        });
    }

    console.log('✅ Full Seed Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
