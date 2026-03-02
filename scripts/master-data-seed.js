const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * master-data-seed.js
 * 
 * [DEPRECATED] This script is outdated as it attempts to migrate from legacy models
 * (IdentityProfile, Stakeholder, etc.) which have been removed from the schema.
 * Please use scripts/seed-full.ts instead for a clean baseline.
 * 
 * One-shot migration of legacy Master Data tables into the new FieldClaim architecture.
 * All legacy data is migrated as "System Baseline" (ownerScopeId = null).
 */

async function clearExistingClaims() {
    console.log("🧹 Clearing existing FieldClaims...");
    await prisma.fieldClaim.deleteMany({});
}

async function migrateIdentityProfiles() {
    const profiles = await prisma.identityProfile.findMany();
    console.log(`📋 Migrating ${profiles.length} IdentityProfiles...`);

    const mappings = [
        { field: 'leiValidationDate', fieldNo: 1 },
        { field: 'leiCode', fieldNo: 2 },
        { field: 'legalName', fieldNo: 3 },
        { field: 'regAddressLine1', fieldNo: 6 },
        { field: 'regAddressCity', fieldNo: 7 },
        { field: 'regAddressRegion', fieldNo: 8 },
        { field: 'regAddressCountry', fieldNo: 9 },
        { field: 'regAddressPostcode', fieldNo: 10 },
        { field: 'hqAddressLine1', fieldNo: 11 },
        { field: 'hqAddressCity', fieldNo: 12 },
        { field: 'hqAddressRegion', fieldNo: 13 },
        { field: 'hqAddressCountry', fieldNo: 14 },
        { field: 'hqAddressPostcode', fieldNo: 15 },
        { field: 'entityStatus', fieldNo: 26 },
        { field: 'entityCreationDate', fieldNo: 27 },
    ];

    for (const p of profiles) {
        if (!p.legalEntityId) continue;

        for (const m of mappings) {
            const val = p[m.field];
            if (val === null || val === undefined) continue;

            await prisma.fieldClaim.create({
                data: {
                    fieldNo: m.fieldNo,
                    subjectLeId: p.legalEntityId,
                    ownerScopeId: null, // Global Baseline
                    valueText: typeof val === 'string' ? val : null,
                    valueDate: val instanceof Date ? val : null,
                    valueNumber: typeof val === 'number' ? String(val) : null,
                    sourceType: 'SYSTEM_DERIVED',
                    status: 'VERIFIED',
                    assertedAt: p.updatedAt || new Date(),
                }
            });
        }
    }
}

async function migrateStakeholders() {
    const stakeholders = await prisma.stakeholder.findMany();
    console.log(`👥 Migrating ${stakeholders.length} Stakeholders...`);

    for (const s of stakeholders) {
        if (!s.legalEntityId) continue;

        let fieldNo = 62; // Default UBO
        if (s.role === 'DIRECTOR') fieldNo = 63;
        if (s.role === 'CONTROLLER') fieldNo = 64;

        // Ensure Person exists or link
        let personId = null;
        if (s.fullName) {
            // For seed, we might reuse or create. Let's assume we create a person record if not linked.
            // In a better seed, we'd deduplicate.
            const person = await prisma.person.create({
                data: {
                    firstName: s.fullName.split(' ')[0],
                    lastName: s.fullName.split(' ').slice(1).join(' ') || 'N/A',
                    dateOfBirth: s.dateOfBirth,
                }
            });
            personId = person.id;
        }

        await prisma.fieldClaim.create({
            data: {
                fieldNo,
                subjectLeId: s.legalEntityId,
                ownerScopeId: null,
                valuePersonId: personId,
                valueText: s.stakeholderType === 'CORPORATE' ? s.legalName : null,
                collectionId: 'STAKEHOLDERS',
                instanceId: s.id, // Legacy ID as stable key
                sourceType: 'USER_INPUT',
                status: 'VERIFIED',
                assertedAt: s.updatedAt || new Date(),
            }
        });
    }
}

async function migrateEntityNames() {
    const names = await prisma.entityName.findMany();
    console.log(`🏷️ Migrating ${names.length} EntityNames...`);

    for (const n of names) {
        if (!n.legalEntityId) continue;

        await prisma.fieldClaim.create({
            data: {
                fieldNo: 4, // Trading name (generalized)
                subjectLeId: n.legalEntityId,
                ownerScopeId: null,
                valueText: n.name,
                collectionId: 'ENTITY_NAMES',
                instanceId: n.id,
                sourceType: 'SYSTEM_DERIVED',
                status: 'VERIFIED',
                assertedAt: n.updatedAt || new Date(),
            }
        });
    }
}

async function migrateIndustryClassifications() {
    const sic = await prisma.industryClassification.findMany();
    console.log(`🏭 Migrating ${sic.length} IndustryClassifications...`);

    for (const s of sic) {
        if (!s.legalEntityId) continue;

        await prisma.fieldClaim.create({
            data: {
                fieldNo: 19, // Main activity
                subjectLeId: s.legalEntityId,
                ownerScopeId: null,
                valueText: `${s.code} - ${s.description}`,
                collectionId: 'INDUSTRY_CODES',
                instanceId: s.id,
                sourceType: 'SYSTEM_DERIVED',
                status: 'VERIFIED',
                assertedAt: s.updatedAt || new Date(),
            }
        });
    }
}

async function main() {
    console.log("🚀 Starting One-Shot Master Data Seed...");

    await clearExistingClaims();
    await migrateIdentityProfiles();
    await migrateStakeholders();
    await migrateEntityNames();
    await migrateIndustryClassifications();

    console.log("✅ Seed Complete! FieldClaim layer is now authoritative.");
}

main()
    .catch(e => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
