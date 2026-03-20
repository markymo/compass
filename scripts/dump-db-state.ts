import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Organizations
    const orgs = await prisma.organization.findMany({ orderBy: { name: 'asc' } });
    console.log('\n=== ORGANIZATIONS ===');
    for (const org of orgs) {
        console.log(`  ${org.name} | types=${JSON.stringify(org.types)} | domain=${org.domain} | id=${org.id}`);
    }

    // Users
    const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
    console.log('\n=== USERS ===');
    for (const u of users) {
        console.log(`  ${u.email} | name=${u.name} | demo=${u.isDemoActor} | id=${u.id}`);
    }

    // Memberships
    const memberships = await prisma.membership.findMany({
        include: { user: { select: { email: true } }, organization: { select: { name: true } } },
        orderBy: { createdAt: 'asc' }
    });
    console.log('\n=== MEMBERSHIPS ===');
    for (const m of memberships) {
        console.log(`  ${m.user.email} -> ${m.organization?.name || 'NO ORG'} | role=${m.role} | clientLEId=${m.clientLEId || 'null'}`);
    }

    // LegalEntities
    const legalEntities = await prisma.legalEntity.findMany();
    console.log('\n=== LEGAL ENTITIES ===');
    for (const le of legalEntities) {
        console.log(`  ref=${le.reference} | id=${le.id}`);
    }

    // ClientLEs
    const clientLEs = await prisma.clientLE.findMany({
        include: {
            owners: { include: { party: { select: { name: true } } } },
            legalEntity: { select: { reference: true } }
        },
        orderBy: { name: 'asc' }
    });
    console.log('\n=== CLIENT LEs ===');
    for (const cle of clientLEs) {
        const owners = cle.owners.map(o => o.party.name).join(', ');
        console.log(`  ${cle.name} | jur=${cle.jurisdiction} | status=${cle.status} | lei=${cle.lei || 'null'} | leRef=${cle.legalEntity?.reference || 'null'} | owners=[${owners}] | id=${cle.id}`);
    }

    // FI Engagements
    const engagements = await prisma.fIEngagement.findMany({
        include: {
            org: { select: { name: true } },
            clientLE: { select: { name: true } }
        },
        orderBy: { clientLE: { name: 'asc' } }
    });
    console.log('\n=== FI ENGAGEMENTS ===');
    for (const eng of engagements) {
        console.log(`  ${eng.clientLE.name} <-> ${eng.org.name} | status=${eng.status} | deleted=${eng.isDeleted} | id=${eng.id}`);
    }

    // Questionnaires
    const questionnaires = await prisma.questionnaire.findMany({
        include: {
            fiOrg: { select: { name: true } },
            fiEngagement: { select: { clientLE: { select: { name: true } } } },
            _count: { select: { questions: true } }
        },
        orderBy: { createdAt: 'asc' }
    });
    console.log('\n=== QUESTIONNAIRES ===');
    for (const q of questionnaires) {
        console.log(`  "${q.name}" | fi=${q.fiOrg.name} | le=${q.fiEngagement?.clientLE?.name || 'UNLINKED'} | status=${q.status} | questions=${q._count.questions} | template=${q.isTemplate} | deleted=${q.isDeleted} | id=${q.id}`);
    }

    // Registry Authorities
    const auths = await prisma.registryAuthority.findMany();
    console.log('\n=== REGISTRY AUTHORITIES ===');
    for (const a of auths) {
        console.log(`  ${a.id} | key=${a.registryKey} | name=${a.name} | country=${a.countryCode}`);
    }

    // RegistryReferences
    const refs = await prisma.registryReference.findMany({
        include: { clientLE: { select: { name: true } }, authority: { select: { registryKey: true } } }
    });
    console.log('\n=== REGISTRY REFERENCES ===');
    for (const r of refs) {
        console.log(`  ${r.clientLE.name} | auth=${r.authority.registryKey} | regNo=${r.localRegistrationNumber} | status=${r.status}`);
    }

    // MasterDataCategories
    const cats = await prisma.masterDataCategory.findMany({ orderBy: { order: 'asc' } });
    console.log('\n=== MASTER DATA CATEGORIES ===');
    for (const c of cats) {
        console.log(`  key=${c.key} | name=${c.displayName} | order=${c.order} | id=${c.id}`);
    }

    // FieldClaim counts by LE
    const claimCounts = await prisma.fieldClaim.groupBy({
        by: ['subjectLeId'],
        _count: true
    });
    console.log('\n=== FIELD CLAIM COUNTS ===');
    for (const cc of claimCounts) {
        const le = cc.subjectLeId ? await prisma.legalEntity.findUnique({ where: { id: cc.subjectLeId } }) : null;
        console.log(`  LE ref=${le?.reference || 'null'} | claims=${cc._count}`);
    }

    // Source field mappings count
    const mappingCount = await prisma.sourceFieldMapping.count();
    console.log(`\n=== SOURCE FIELD MAPPINGS: ${mappingCount} total ===`);

    // Source sample payloads
    const sampleCount = await prisma.sourceSamplePayload.count();
    console.log(`=== SOURCE SAMPLE PAYLOADS: ${sampleCount} total ===`);

    // AdminTodos
    const todos = await prisma.adminTodo.findMany();
    console.log(`\n=== ADMIN TODOS: ${todos.length} total ===`);

    // Persons
    const persons = await prisma.person.findMany();
    console.log(`\n=== PERSONS: ${persons.length} total ===`);
    for (const p of persons) {
        console.log(`  ${p.firstName} ${p.lastName} | id=${p.id}`);
    }

    // Documents
    const docs = await prisma.document.findMany({
        include: { clientLE: { select: { name: true } } }
    });
    console.log(`\n=== DOCUMENTS: ${docs.length} total ===`);
    for (const d of docs) {
        console.log(`  ${d.name} | le=${d.clientLE.name} | type=${d.fileType}`);
    }

    // Custom Field Definitions
    const customFields = await prisma.customFieldDefinition.findMany({
        include: { organization: { select: { name: true } } }
    });
    console.log(`\n=== CUSTOM FIELD DEFINITIONS: ${customFields.length} total ===`);
    for (const cf of customFields) {
        console.log(`  key=${cf.key} | label=${cf.label} | org=${cf.organization.name}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
