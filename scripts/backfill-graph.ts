import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLIENT_LE_ID = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';

async function processPSC(psc: any) {
    const isCorporate = (psc.kind || '').includes('corporate');
    const isActive = !psc.ceased && !psc.ceased_on;
    const source = 'REGISTRATION_AUTHORITY';

    let graphNodeId: string | null = null;

    if (isCorporate) {
        const regNum = psc.identification?.registration_number;
        const query = regNum
            ? { localRegistrationNumber: regNum }
            : { name: psc.name };

        let le = await prisma.legalEntity.findFirst({ where: query });
        if (!le) {
            le = await prisma.legalEntity.create({
                data: { reference: `PSC-${Date.now()}`, name: psc.name || null, localRegistrationNumber: regNum || null }
            });
        }

        const existingNode = await prisma.clientLEGraphNode.findFirst({ where: { clientLEId: CLIENT_LE_ID, legalEntityId: le.id } });
        graphNodeId = existingNode?.id ?? (await prisma.clientLEGraphNode.create({
            data: { clientLEId: CLIENT_LE_ID, nodeType: 'LEGAL_ENTITY', legalEntityId: le.id, source }
        })).id;
    } else {
        // "LASTNAME, Firstname Middlename" format
        const parts = (psc.name || '').split(', ');
        const lastName = parts[0] || null;
        const firstName = parts[1]?.split(' ')[0] || null;

        let person = await prisma.person.findFirst({ where: { firstName, lastName } });
        if (!person) {
            person = await prisma.person.create({
                data: { firstName, lastName, primaryNationality: psc.nationality || null }
            });
        }

        const existingNode = await prisma.clientLEGraphNode.findFirst({ where: { clientLEId: CLIENT_LE_ID, personId: person.id } });
        graphNodeId = existingNode?.id ?? (await prisma.clientLEGraphNode.create({
            data: { clientLEId: CLIENT_LE_ID, nodeType: 'PERSON', personId: person.id, source }
        })).id;
    }

    if (!graphNodeId) return;

    await prisma.clientLEGraphEdge.upsert({
        where: { fromNodeId_edgeType: { fromNodeId: graphNodeId, edgeType: 'PSC_CONTROL' } },
        create: {
            clientLEId: CLIENT_LE_ID,
            fromNodeId: graphNodeId,
            edgeType: 'PSC_CONTROL',
            naturesOfControl: psc.natures_of_control || [],
            notifiedOn: psc.notified_on ? new Date(psc.notified_on) : null,
            ceasedOn: psc.ceased_on ? new Date(psc.ceased_on) : null,
            isActive,
            source,
        },
        update: {
            naturesOfControl: psc.natures_of_control || [],
            ceasedOn: psc.ceased_on ? new Date(psc.ceased_on) : null,
            isActive,
        }
    });

    console.log(`  ✓ ${isActive ? 'Active' : 'Ceased'} PSC: ${psc.name}`);
}

async function main() {
    const evidence = await prisma.evidenceStore.findFirst({
        where: { provider: 'REGISTRATION_AUTHORITY' },
        orderBy: { createdAt: 'desc' },
        select: { payload: true }
    });

    const pscs: any[] = (evidence?.payload as any)?.pscs || [];
    console.log(`Processing ${pscs.length} PSCs...`);
    pscs.forEach((p: any) => console.log(`  - ${p.name} [${p.kind}] ${p.ceased ? 'CEASED' : 'ACTIVE'}`));
    console.log('');

    for (const psc of pscs) {
        await processPSC(psc);
    }

    const edges = await prisma.clientLEGraphEdge.findMany({
        where: { clientLEId: CLIENT_LE_ID },
        include: { fromNode: { include: { legalEntity: true, person: true } } }
    });

    console.log(`\n✅ Total graph edges: ${edges.length}`);
    for (const e of edges) {
        const n = (e.fromNode as any);
        const name = n?.legalEntity?.name || `${n?.person?.firstName} ${n?.person?.lastName}`;
        console.log(`  [${e.edgeType}] ${name} | active=${e.isActive} | controls: ${e.naturesOfControl.join(', ')}`);
    }
}

main().then(() => process.exit(0)).catch((e: any) => { console.error(e); process.exit(1); });
