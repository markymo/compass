// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FIELD_DEFINITIONS } from '../src/domain/kyc/FieldDefinitions';
import { FIELD_GROUPS } from '../src/domain/kyc/FieldGroups';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Idempotent Production Seed...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- 1. SEED SYSTEM ORGANIZATION ---
    console.log('🏢 Seeding System Organization...');

    async function ensureOrg(name: string, types: string[], domain: string) {
        let org = await prisma.organization.findFirst({ where: { name } });
        if (!org) {
            org = await prisma.organization.create({
                data: { name, types, domain, status: 'ACTIVE' }
            });
        }
        return org;
    }

    const systemOrg = await ensureOrg('Compass System', ['SYSTEM'], 'compass.ai');

    // --- 2. SEED ADMIN USERS ---
    console.log('👤 Seeding System Admins...');

    async function ensureAdminUser(email: string, name: string) {
        return await prisma.user.upsert({
            where: { email },
            update: { name, isDemoActor: false },
            create: { email, name, password: passwordHash, isDemoActor: false }
        });
    }

    const mark = await ensureAdminUser('mark@30gram6.com', 'Mark Lissaman');
    const rob = await ensureAdminUser('rdorntonduff@riskbridge.com', 'Rob Dornton-Duff');

    // --- 3. SEED MEMBERSHIPS ---
    console.log('🔑 Seeding Admin Memberships...');

    async function ensureMembership(userId: string, orgId: string, role: string) {
        let member = await prisma.membership.findFirst({
            where: { userId, organizationId: orgId, clientLEId: null }
        });
        if (!member) {
            await prisma.membership.create({
                data: { userId, organizationId: orgId, role, clientLEId: null }
            });
        }
    }

    await ensureMembership(mark.id, systemOrg.id, 'SYSTEM_ADMIN');
    await ensureMembership(rob.id, systemOrg.id, 'SYSTEM_ADMIN');

    // --- 4. SEED MASTER SCHEMA (ATOMIC FIELDS) ---
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
                isActive: true, // Keep it active
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

    // --- 5.5. SEED SYSTEM CATEGORIES ---
    console.log('📂 Seeding System Categories...');
    const normalize = (name: string) =>
        name.trim().toLowerCase().replace(/[\s\W]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const categoryNames = Array.from(
        new Set(Object.values(FIELD_DEFINITIONS).map(d => d.model).filter(Boolean))
    );

    const categoryMap = new Map<string, string>(); // displayName -> id

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
    let fieldsLinked = 0;
    for (const fieldNoStr of Object.keys(FIELD_DEFINITIONS)) {
        const fieldNo = Number(fieldNoStr);
        const def = FIELD_DEFINITIONS[fieldNo];
        const catId = categoryMap.get(def.model);
        if (catId) {
            await prisma.masterFieldDefinition.update({
                where: { fieldNo },
                data: { categoryId: catId, categoryLabel: def.model }
            });
            fieldsLinked++;
        }
    }

    // --- 6. SEED REGISTRY AUTHORITIES ---
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

    // --- 7. SEED DEFAULT GLEIF SAMPLE PAYLOAD ---
    console.log('📦 Seeding Default GLEIF Sample Payload...');
    const gleifSamplePayload = {
      lei: "549300MLUDYVRQOOXS22",
      entity: {
        status: "ACTIVE",
        category: "GENERAL",
        legalName: {
          name: "HSBC Holdings plc",
          language: "en"
        },
        creationDate: "1959-01-01T00:00:00.000Z",
        jurisdiction: "GB",
        legalAddress: {
          city: "London",
          region: "GB-LND",
          country: "GB",
          language: "en",
          postalCode: "E14 5HQ",
          addressLines: [
            "8 Canada Square"
          ]
        },
        registeredAs: "617987",
        registeredAt: {
          id: "RA000585"
        },
        headquartersAddress: {
          city: "London",
          region: "GB-LND",
          country: "GB",
          language: "en",
          postalCode: "E14 5HQ",
          addressLines: [
            "8 Canada Square"
          ]
        }
      },
      gleifL2: {
        fetchedAt: "2026-06-11T12:50:45Z",
        directParent: {
          lei: "54930005OPLAX5193B63",
          legalName: "HSBC Group East Asia Holdings Limited",
          legalFormId: "FBL0",
          entityStatus: "ACTIVE",
          jurisdiction: "HK",
          registeredAs: "12345678",
          registeredAt: "RA000411",
          registrationStatus: "ISSUED"
        },
        ultimateParent: {
          lei: "549300MLUDYVRQOOXS22",
          legalName: "HSBC Holdings plc",
          legalFormId: "8FGD",
          entityStatus: "ACTIVE",
          jurisdiction: "GB",
          registeredAs: "617987",
          registeredAt: "RA000585",
          registrationStatus: "ISSUED"
        },
        directChildrenCount: 12,
        directParentException: null,
        ultimateParentException: null
      },
      gleifElf: {
        id: "8FGD",
        name: "Public Limited Company",
        fetchedAt: "2026-06-11T12:50:45Z",
        jurisdictionCode: "GB"
      },
      registration: {
        status: "ISSUED",
        managingLOU: "EVK05KS7XY1DEII3R011",
        lastUpdateDate: "2024-06-20T21:31:00.000Z",
        nextRenewalDate: "2025-06-19T21:31:00.000Z",
        initialRegistrationDate: "2012-06-06T15:53:00.000Z"
      }
    };

    const existing = await prisma.sourceSamplePayload.findFirst({
        where: { sourceType: "GLEIF", isDefault: true }
    });

    if (existing) {
        await prisma.sourceSamplePayload.update({
            where: { id: existing.id },
            data: {
                payload: gleifSamplePayload,
                label: "HSBC Holdings plc (Default Preview)"
            }
        });
    } else {
        await prisma.sourceSamplePayload.create({
            data: {
                sourceType: "GLEIF",
                label: "HSBC Holdings plc (Default Preview)",
                payload: gleifSamplePayload,
                isDefault: true
            }
        });
    }

    console.log('✅ Production Seed Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
