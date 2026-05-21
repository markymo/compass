/**
 * One-shot: bootstrap a single entity via LegalEntityEnrichmentService.bootstrapEntity
 * Triggers GLEIF claim re-apply + CH RegistryReference discovery + OFFICERS/PSC fetch.
 * 
 * Run: npx tsx scripts/bootstrap-single-entity.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local', override: true });

import prisma from '../src/lib/prisma';
import { LegalEntityEnrichmentService } from '../src/domain/registry/LegalEntityEnrichmentService';

const CLIENT_LE_ID = '5fa3bbeb-297e-482a-8104-1d4407c89a39'; // ORSTED HORNSEA PROJECT THREE (UK) LIMITED

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('ep-silent-flower-abi2jpdp')) {
    console.error('❌ NOT PRODUCTION — aborting.');
    process.exit(1);
}
console.log('✅ Confirmed: ep-silent-flower-abi2jpdp\n');

async function main() {
    // Pre-check
    const le = await prisma.clientLE.findUnique({
        where: { id: CLIENT_LE_ID },
        select: { lei: true, gleifFetchedAt: true, registryReferences: { select: { id: true, localRegistrationNumber: true } } }
    });
    console.log('LEI:', le?.lei);
    console.log('GLEIF fetched:', le?.gleifFetchedAt);
    console.log('Existing RegistryRefs:', le?.registryReferences?.length ?? 0);

    console.log('\n=== Running bootstrapEntity ===');
    const result = await LegalEntityEnrichmentService.bootstrapEntity(CLIENT_LE_ID);
    console.log('Result:', JSON.stringify(result));

    // Post-check
    console.log('\n=== POST: RegistryReferences ===');
    const refs = await prisma.registryReference.findMany({
        where: { clientLEId: CLIENT_LE_ID },
        select: { id: true, localRegistrationNumber: true, lastSyncStatus: true, lastSyncSucceededAt: true }
    });
    console.log(JSON.stringify(refs, null, 2));

    console.log('\n=== POST: Field 63 (Directors) claims ===');
    const dirLE = await prisma.clientLE.findUnique({ where: { id: CLIENT_LE_ID }, select: { legalEntityId: true } });
    const dirs = await prisma.fieldClaim.findMany({
        where: { subjectLeId: dirLE?.legalEntityId, fieldNo: 63 },
        select: { instanceId: true, collectionId: true, valueJson: true, sourceType: true }
    });
    console.log('Count:', dirs.length);
    dirs.slice(0, 5).forEach((d, i) => console.log(`  [${i}]`, JSON.stringify(d)));
}

main()
    .catch(e => { console.error('FATAL:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
