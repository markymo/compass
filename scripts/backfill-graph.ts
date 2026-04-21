import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deletes all Field 63 claims for the given LE so that the next registry
 * refresh writes fresh, correctly-filtered (active only) claims.
 * 
 * Safe because FieldClaim is immutable-by-design and the registry
 * will re-assert the ground truth on the next sync.
 */
async function resetField63() {
    const clientLEId = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
    const le = await prisma.clientLE.findUnique({ where: { id: clientLEId }});
    if (!le?.legalEntityId) { console.error('LE not found'); return; }

    const existing = await prisma.fieldClaim.findMany({
        where: { subjectLeId: le.legalEntityId, fieldNo: 63 },
        select: { id: true, valuePersonId: true, collectionId: true, assertedAt: true }
    });

    console.log(`Found ${existing.length} Field 63 claims to delete (${new Set(existing.map((c: any) => c.valuePersonId)).size} unique persons)`);
    console.log('Collection IDs:', [...new Set(existing.map((c: any) => c.collectionId))]);

    const { count } = await prisma.fieldClaim.deleteMany({
        where: { subjectLeId: le.legalEntityId, fieldNo: 63 }
    });

    console.log(`\n✅ Deleted ${count} claims. Run a Companies House refresh to re-assert with active-only data.`);
}

resetField63().then(() => process.exit(0)).catch((e: any) => { console.error(e); process.exit(1); });
