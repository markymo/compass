/**
 * Diagnostic: show all Field 3 (Legal Name) claims for entity 383c5ec1-5ab8-4df5-9e40-859dbf1c3726
 * Run with: npx tsx scratch/diagnose-field3-claims.ts
 */
import prisma from '../src/lib/prisma';

const CLIENT_LE_ID = '383c5ec1-5ab8-4df5-9e40-859dbf1c3726';
const FIELD_NO = 3;

async function main() {
    // 1. Resolve legalEntityId
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: CLIENT_LE_ID },
        select: { legalEntityId: true, name: true, lei: true }
    });

    console.log('\n=== ClientLE ===');
    console.log(clientLE);

    if (!clientLE?.legalEntityId) {
        console.log('No legalEntityId — cannot find field claims');
        return;
    }

    // 2. Fetch all Field 3 claims
    const claims = await (prisma as any).fieldClaim.findMany({
        where: {
            subjectLeId: clientLE.legalEntityId,
            fieldNo: FIELD_NO,
        },
        include: { evidence: true },
        orderBy: { assertedAt: 'desc' }
    });

    console.log(`\n=== Field ${FIELD_NO} claims (${claims.length} total) ===`);
    for (const c of claims) {
        console.log({
            id: c.id,
            sourceType: c.sourceType,
            sourceReference: c.sourceReference,
            status: c.status,
            valueText: c.valueText,
            assertedAt: c.assertedAt,
            evidenceProvider: c.evidence?.provider ?? null,
            ownerScopeId: c.ownerScopeId,
        });
    }

    // 3. Show active GLEIF SourceFieldMappings for Field 3
    const gleifMappings = await (prisma as any).sourceFieldMapping.findMany({
        where: { targetFieldNo: FIELD_NO, sourceType: 'GLEIF' },
        select: { id: true, isActive: true, priority: true, sourcePath: true }
    });
    console.log(`\n=== GLEIF SourceFieldMappings for Field ${FIELD_NO} ===`);
    console.log(gleifMappings.length === 0 ? '(none)' : gleifMappings);

    // 4. Show RA SourceFieldMappings for Field 3
    const raMappings = await (prisma as any).sourceFieldMapping.findMany({
        where: { targetFieldNo: FIELD_NO, sourceType: 'REGISTRATION_AUTHORITY' },
        select: { id: true, isActive: true, priority: true, sourcePath: true, sourceReference: true }
    });
    console.log(`\n=== REGISTRATION_AUTHORITY SourceFieldMappings for Field ${FIELD_NO} ===`);
    console.log(raMappings.length === 0 ? '(none)' : raMappings);
}

main().catch(console.error).finally(() => prisma.$disconnect());
