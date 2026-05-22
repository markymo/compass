import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const p = new PrismaClient();

async function main() {
    const cats = await p.masterDataCategory.findMany({
        include: { fields: { include: { sourceMappings: true } } },
        orderBy: { order: 'asc' }
    });

    console.log('\n=== CATEGORY REFERENCE AUDIT ===\n');

    for (const c of cats) {
        const fieldNos = c.fields.map(f => f.fieldNo);
        const activeMappings = c.fields.reduce((a, f) => a + f.sourceMappings.filter(m => m.isActive).length, 0);
        const totalMappings = c.fields.reduce((a, f) => a + f.sourceMappings.length, 0);

        let claims = 0;
        let questions = 0;
        let assignments = 0;
        let notes = 0;

        if (fieldNos.length > 0) {
            const claimRes = await p.$queryRaw`SELECT COUNT(*)::int as cnt FROM field_claims WHERE "fieldNo" = ANY(${fieldNos})`;
            claims = Number(claimRes[0]?.cnt ?? 0);

            const qRes = await p.$queryRaw`SELECT COUNT(*)::int as cnt FROM "Question" WHERE "masterFieldNo" = ANY(${fieldNos})`;
            questions = Number(qRes[0]?.cnt ?? 0);

            const aRes = await p.$queryRaw`SELECT COUNT(*)::int as cnt FROM master_field_assignments WHERE "fieldNo" = ANY(${fieldNos})`;
            assignments = Number(aRes[0]?.cnt ?? 0);

            const nRes = await p.$queryRaw`SELECT COUNT(*)::int as cnt FROM master_field_notes WHERE "fieldNo" = ANY(${fieldNos})`;
            notes = Number(nRes[0]?.cnt ?? 0);
        }

        const danger = (claims > 0 || questions > 0 || activeMappings > 0) ? '⚠️  HAS LIVE REFS' : (fieldNos.length === 0 ? '✅  EMPTY (safe hard delete)' : '🟡  FIELDS ONLY');

        console.log(`${c.displayName} (key: ${c.key})`);
        console.log(`  Fields: ${c.fields.length}  |  Source mappings: ${totalMappings} (${activeMappings} active)  |  FieldClaims: ${claims}  |  Questions: ${questions}  |  Assignments: ${assignments}  |  Notes: ${notes}`);
        console.log(`  Status: ${danger}\n`);
    }
}

main().catch(e => { console.error(e); }).finally(() => p.$disconnect());
