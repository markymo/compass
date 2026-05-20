/**
 * inspect-directors.ts
 *
 * Deep inspection of Field 63 (Current Directors) for a specific LE.
 * Read-only. No mutations.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scratch/inspect-directors.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LE_ID  = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
const FIELD_NO = 63;

function hr(label: string) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${label}`);
    console.log('═'.repeat(70));
}

function section(label: string) {
    console.log(`\n── ${label} ─────────────────────────────────────────`);
}

async function main() {
    // ── 0. Resolve subject ──────────────────────────────────────────────────────
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: LE_ID },
        select: { id: true, name: true, legalEntityId: true }
    });
    if (!clientLE) { console.error('ClientLE not found'); process.exit(1); }
    const subjectLeId = clientLE.legalEntityId!;

    hr('0. SUBJECT');
    console.log(`  ClientLE ID   : ${clientLE.id}`);
    console.log(`  Name          : ${clientLE.name}`);
    console.log(`  LegalEntity ID: ${subjectLeId}`);

    // ── 1. FieldClaim inspection ─────────────────────────────────────────────
    hr('1. FIELD CLAIMS  (fieldNo=63)');

    const claims = await prisma.fieldClaim.findMany({
        where: { fieldNo: FIELD_NO, subjectLeId },
        include: { valuePerson: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ instanceId: 'asc' }, { assertedAt: 'desc' }]
    });

    console.log(`\n  Total rows: ${claims.length}`);

    // Categorise
    const tombstones   = claims.filter(c => (c.valueJson as any)?.tombstone === true);
    const withPerson   = claims.filter(c => c.valuePersonId !== null);
    const withJson     = claims.filter(c => c.valueJson !== null && !((c.valueJson as any)?.tombstone));
    const withLe       = claims.filter(c => c.valueLeId !== null);
    const withText     = claims.filter(c => c.valueText !== null);
    const raSource     = claims.filter(c => c.sourceType === 'REGISTRATION_AUTHORITY');
    const userSource   = claims.filter(c => c.sourceType === 'USER_INPUT');
    const withEffFrom  = claims.filter(c => c.effectiveFrom !== null);
    const withEffTo    = claims.filter(c => c.effectiveTo !== null);
    const resigned     = claims.filter(c => c.effectiveTo !== null);

    section('Claim categorisation');
    console.log(`  valuePersonId set      : ${withPerson.length}`);
    console.log(`  valueLeId set          : ${withLe.length}`);
    console.log(`  valueText set          : ${withText.length}`);
    console.log(`  valueJson (non-tomb)   : ${withJson.length}  ${withJson.length > 0 ? '⚠️  JSON blobs present' : '✅'}`);
    console.log(`  tombstones             : ${tombstones.length}`);
    console.log(`  sourceType=RA          : ${raSource.length}`);
    console.log(`  sourceType=USER_INPUT  : ${userSource.length}`);
    console.log(`  effectiveFrom set      : ${withEffFrom.length}`);
    console.log(`  effectiveTo set        : ${withEffTo.length}  (resigned directors preserved)`);

    section('instanceId patterns');
    const instanceIds = [...new Set(claims.map(c => c.instanceId).filter(Boolean))];
    const deterministicIds  = instanceIds.filter(id => id!.startsWith('ch_'));
    const ephemeralIds      = instanceIds.filter(id => id!.startsWith('auto_'));
    const otherIds          = instanceIds.filter(id => !id!.startsWith('ch_') && !id!.startsWith('auto_'));
    console.log(`  Unique instanceIds     : ${instanceIds.length}`);
    console.log(`  Deterministic (ch_*)   : ${deterministicIds.length}  ${deterministicIds.length > 0 ? '✅' : ''}`);
    console.log(`  Ephemeral (auto_*)     : ${ephemeralIds.length}  ${ephemeralIds.length > 0 ? '⚠️  pre-rowKey ingestion' : ''}`);
    console.log(`  Other                  : ${otherIds.length}`);
    if (instanceIds.length > 0) {
        console.log('\n  Sample instanceIds:');
        instanceIds.slice(0, 10).forEach(id => console.log(`    ${id}`));
    }

    section('collectionId values');
    const collectionIds = [...new Set(claims.map(c => c.collectionId).filter(Boolean))];
    collectionIds.forEach(cid => console.log(`  ${cid}`));
    if (collectionIds.length === 0) console.log('  (none — using default grouping)');

    section('Sample claim rows (latest 6)');
    const sample = claims.slice(0, 6);
    sample.forEach(c => {
        const personLabel = c.valuePerson ? `${c.valuePerson.firstName ?? ''} ${c.valuePerson.lastName ?? ''}`.trim() : '—';
        console.log([
            `  [${c.status}] src=${c.sourceType}`,
            `instanceId=${c.instanceId ?? 'NULL'}`,
            `person=${personLabel} (${c.valuePersonId?.slice(0, 8) ?? 'null'})`,
            `effFrom=${c.effectiveFrom ? c.effectiveFrom.toISOString().slice(0, 10) : 'null'}`,
            `effTo=${c.effectiveTo ? c.effectiveTo.toISOString().slice(0, 10) : 'null'}`,
            `json=${c.valueJson ? '⚠️ SET' : 'null'}`
        ].join(' | '));
    });

    section('JSON blob sample (potential issue)');
    if (withJson.length > 0) {
        withJson.slice(0, 3).forEach(c => {
            console.log(`  claimId=${c.id.slice(0, 8)} instanceId=${c.instanceId}`);
            console.log(`  valueJson=`, JSON.stringify(c.valueJson).slice(0, 200));
        });
    } else {
        console.log('  ✅ No non-tombstone JSON blobs found');
    }

    // ── 2. Person materialisation ─────────────────────────────────────────────
    hr('2. PERSON MATERIALISATION');

    const personIds = [...new Set(withPerson.map(c => c.valuePersonId!))];
    console.log(`\n  Unique Person IDs referenced: ${personIds.length}`);

    const persons = await prisma.person.findMany({
        where: { id: { in: personIds } },
        orderBy: { lastName: 'asc' }
    });

    section('Person rows');
    persons.forEach(p => {
        const fullName = `${p.firstName ?? '?'} ${p.lastName ?? '?'}`.trim();
        console.log(`  [${p.id.slice(0, 8)}] ${fullName.padEnd(40)} dob=${p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : 'null'} nat=${p.primaryNationality ?? 'null'}`);
    });

    // Detect potential duplicates by name
    section('Duplicate name check');
    const nameCounts: Record<string, number> = {};
    persons.forEach(p => {
        const key = `${(p.firstName ?? '').toLowerCase().trim()}|${(p.lastName ?? '').toLowerCase().trim()}`;
        nameCounts[key] = (nameCounts[key] || 0) + 1;
    });
    const duplicates = Object.entries(nameCounts).filter(([, n]) => n > 1);
    if (duplicates.length > 0) {
        console.log('  ⚠️  Potential duplicate Person rows by name:');
        duplicates.forEach(([name, count]) => console.log(`    "${name}" × ${count}`));
    } else {
        console.log('  ✅ No duplicate persons by name');
    }

    // ── 3. Graph nodes and edges ──────────────────────────────────────────────
    hr('3. GRAPH NODES & EDGES');

    const nodes = await prisma.clientLEGraphNode.findMany({
        where: { clientLEId: LE_ID },
        include: {
            person: { select: { id: true, firstName: true, lastName: true } },
            legalEntity: { select: { id: true, name: true } },
            address: { select: { id: true, line1: true, city: true } }
        }
    });

    section('Node counts by type');
    const nodesByType: Record<string, number> = {};
    nodes.forEach(n => { nodesByType[n.nodeType] = (nodesByType[n.nodeType] || 0) + 1; });
    Object.entries(nodesByType).forEach(([t, n]) => console.log(`  ${t.padEnd(15)}: ${n}`));
    console.log(`  TOTAL          : ${nodes.length}`);

    const edges = await prisma.clientLEGraphEdge.findMany({
        where: { clientLEId: LE_ID },
        include: {
            fromNode: {
                include: {
                    person: { select: { firstName: true, lastName: true } },
                    legalEntity: { select: { name: true } }
                }
            }
        },
        orderBy: { edgeType: 'asc' }
    });

    section('Edge counts by type');
    const edgesByType: Record<string, number> = {};
    edges.forEach(e => { edgesByType[e.edgeType] = (edgesByType[e.edgeType] || 0) + 1; });
    Object.entries(edgesByType).forEach(([t, n]) => console.log(`  ${t.padEnd(20)}: ${n}`));
    console.log(`  TOTAL                : ${edges.length}`);

    section('DIRECTOR edges detail');
    const directorEdges = edges.filter(e => e.edgeType === 'DIRECTOR');
    const activeDir   = directorEdges.filter(e => e.isActive);
    const inactiveDir = directorEdges.filter(e => !e.isActive);
    console.log(`  Active DIRECTOR   : ${activeDir.length}`);
    console.log(`  Inactive DIRECTOR : ${inactiveDir.length}  ${inactiveDir.length > 0 ? '✅ resigned preserved' : ''}`);
    directorEdges.forEach(e => {
        const who = e.fromNode.person
            ? `${e.fromNode.person.firstName ?? ''} ${e.fromNode.person.lastName ?? ''}`.trim()
            : e.fromNode.legalEntity?.name ?? 'Unknown';
        console.log(`  [${e.isActive ? 'ACTIVE  ' : 'INACTIVE'}] ${who.padEnd(40)} notifiedOn=${e.notifiedOn ? e.notifiedOn.toISOString().slice(0, 10) : 'null'} ceasedOn=${e.ceasedOn ? e.ceasedOn.toISOString().slice(0, 10) : 'null'}`);
    });

    // ── 4. Re-enrichment duplication check ───────────────────────────────────
    hr('4. RE-ENRICHMENT DUPLICATION ANALYSIS');

    section('instanceId strategy');
    console.log(`  Deterministic (ch_*) count : ${deterministicIds.length}`);
    console.log(`  Ephemeral (auto_*)    count : ${ephemeralIds.length}`);

    if (ephemeralIds.length > 0) {
        console.log('\n  ⚠️  Ephemeral instanceIds detected. These were created before the stable');
        console.log('  rowKey implementation. On next enrichment run, KycWriteService will try to');
        console.log('  upsert using the deterministic ch_* key. Since the auto_* rows have');
        console.log('  different instanceIds, they will NOT be superseded — creating duplicates.');
        console.log('\n  RISK: Running enrichment now would create a second set of ch_* claims');
        console.log('  alongside the existing auto_* claims until the old ones are purged.');
    } else if (deterministicIds.length > 0) {
        console.log('\n  ✅ All instanceIds are deterministic (ch_*). Re-enrichment is safe.');
        console.log('  KycWriteService will find existing claims by instanceId and supersede cleanly.');
    } else {
        console.log('\n  ⚠️  No instanceIds set at all — collection grouping falls back to');
        console.log('  (fieldNo, collectionId=null, instanceId=null) meaning all claims group as one.');
    }

    // Check for per-instanceId multiple claims (winners among duplicates)
    section('Per-instanceId claim count (duplication check)');
    const instanceClaimCount: Record<string, number> = {};
    claims.forEach(c => {
        const key = c.instanceId ?? 'NULL';
        instanceClaimCount[key] = (instanceClaimCount[key] || 0) + 1;
    });
    const overloaded = Object.entries(instanceClaimCount).filter(([, n]) => n > 1);
    if (overloaded.length > 0) {
        console.log('  ⚠️  Multiple claims per instanceId (winner selection required):');
        overloaded.forEach(([id, n]) => console.log(`    ${id}: ${n} claims`));
    } else {
        console.log('  ✅ One claim per instanceId — no redundant rows');
    }

    // Graph edge deduplication check
    section('Graph edge uniqueness (unique constraint: fromNodeId+toNodeId+edgeType)');
    const edgeSigs: Record<string, number> = {};
    edges.forEach(e => {
        const key = `${e.fromNodeId}|${e.toNodeId ?? 'null'}|${e.edgeType}`;
        edgeSigs[key] = (edgeSigs[key] || 0) + 1;
    });
    const dupEdges = Object.entries(edgeSigs).filter(([, n]) => n > 1);
    if (dupEdges.length > 0) {
        console.log(`  ⚠️  ${dupEdges.length} duplicate edge signature(s) found`);
    } else {
        console.log('  ✅ All graph edges are unique by (fromNode, toNode, edgeType)');
    }

    // ── 5. Current-director filtering validation ─────────────────────────────
    hr('5. CURRENT-DIRECTOR FILTERING VALIDATION');

    section('Simulating getAuthoritativeCollection effectiveTo filter');
    const now = new Date();

    // Group by instanceId, pick winner per group
    const itemGroups: Record<string, any[]> = {};
    for (const c of claims) {
        const key = `${c.collectionId ?? 'default'}:${c.instanceId ?? 'default'}`;
        if (!itemGroups[key]) itemGroups[key] = [];
        itemGroups[key].push(c);
    }

    interface DirectorResult {
        instanceId: string | null;
        name: string;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
        isCurrent: boolean;
        isTombstone: boolean;
    }

    const results: DirectorResult[] = [];
    for (const [, group] of Object.entries(itemGroups)) {
        // simplified winner: highest source priority, newest assertedAt
        const winner = group.sort((a: any, b: any) => b.assertedAt.getTime() - a.assertedAt.getTime())[0];
        const isTombstone = (winner.valueJson as any)?.tombstone === true;
        if (isTombstone) continue;

        const isCurrent = !winner.effectiveTo || winner.effectiveTo > now;
        const person = winner.valuePerson as any;
        const name = person
            ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
            : winner.valuePersonId ? `Person:${winner.valuePersonId.slice(0, 8)}` : 'Unknown';

        results.push({
            instanceId: winner.instanceId,
            name,
            effectiveFrom: winner.effectiveFrom,
            effectiveTo: winner.effectiveTo,
            isCurrent,
            isTombstone
        });
    }

    const currentDirectors  = results.filter(r => r.isCurrent);
    const resignedDirectors = results.filter(r => !r.isCurrent);

    console.log(`\n  Current directors  : ${currentDirectors.length}  ✅`);
    console.log(`  Resigned (history) : ${resignedDirectors.length}`);

    section('Current directors list');
    if (currentDirectors.length > 0) {
        currentDirectors.forEach(r => {
            console.log(`  ✅  ${r.name.padEnd(40)} from=${r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : 'null'}`);
        });
    } else {
        console.log('  (none)');
    }

    section('Historically resigned directors (preserved)');
    if (resignedDirectors.length > 0) {
        resignedDirectors.forEach(r => {
            console.log(`  📅  ${r.name.padEnd(40)} from=${r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : 'null'} to=${r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : '?'}`);
        });
    } else {
        console.log('  (none — all directors currently active, or effectiveTo not yet set)');
    }

    // ── 6. Alignment: FieldClaims vs Graph Edges ──────────────────────────────
    hr('6. FIELDCLAIM ↔ GRAPH ALIGNMENT');

    const claimPersonIds  = new Set(withPerson.map(c => c.valuePersonId!));
    const nodePersonIds   = new Set(nodes.filter(n => n.personId).map(n => n.personId!));

    section('Person coverage');
    const inClaimsNotGraph = [...claimPersonIds].filter(id => !nodePersonIds.has(id));
    const inGraphNotClaims = [...nodePersonIds].filter(id => !claimPersonIds.has(id));
    console.log(`  Persons in claims        : ${claimPersonIds.size}`);
    console.log(`  Persons as graph nodes   : ${nodePersonIds.size}`);
    console.log(`  In claims but NOT graph  : ${inClaimsNotGraph.length}  ${inClaimsNotGraph.length > 0 ? '⚠️  missing nodes' : '✅'}`);
    console.log(`  In graph but NOT claims  : ${inGraphNotClaims.length}  ${inGraphNotClaims.length > 0 ? '⚠️  orphan nodes' : '✅'}`);

    // ── 7. Final summary ──────────────────────────────────────────────────────
    hr('7. SUMMARY');

    const issues: string[] = [];
    const ok: string[] = [];

    if (withJson.length > 0) issues.push(`${withJson.length} non-tombstone JSON blobs in FieldClaims — pre-fix data`);
    else ok.push('No JSON blobs — all directors materialised as Person FKs');

    if (ephemeralIds.length > 0) issues.push(`${ephemeralIds.length} ephemeral auto_* instanceIds — re-enrichment risk`);
    else if (deterministicIds.length > 0) ok.push('All instanceIds are deterministic (ch_*)');

    if (inClaimsNotGraph.length > 0) issues.push(`${inClaimsNotGraph.length} persons in claims but missing from graph nodes`);
    else ok.push('FieldClaim persons fully covered by graph nodes');

    if (dupEdges.length > 0) issues.push(`${dupEdges.length} duplicate graph edges`);
    else ok.push('Graph edges are unique');

    if (duplicates.length > 0) issues.push(`${duplicates.length} potential duplicate Person rows by name`);
    else ok.push('No duplicate Person rows by name');

    section('✅ Working correctly');
    ok.forEach(msg => console.log(`  ✅  ${msg}`));

    section('⚠️  Issues / risks');
    if (issues.length === 0) {
        console.log('  ✅  No issues detected');
    } else {
        issues.forEach(msg => console.log(`  ⚠️   ${msg}`));
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
