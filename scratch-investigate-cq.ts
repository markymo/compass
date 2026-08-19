import prisma from "./src/lib/prisma";

async function main() {
    const leId = "c85879e4-0db1-45bf-800d-e6ba5f4c740c";

    // 1. LE details
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        select: { id: true, name: true, shortCode: true, isDeleted: true }
    });
    console.log("=== LE ===", le);

    // 2. Owners
    const owners = await (prisma.clientLEOwner as any).findMany({
        where: { clientLEId: leId },
        include: { party: { select: { id: true, name: true } } }
    });
    console.log("\n=== ALL OWNERS ===", JSON.stringify(owners, null, 2));

    // 3. Active owners
    const activeOwners = owners.filter((o: any) => !o.endAt);
    console.log("\n=== ACTIVE OWNERS ===", activeOwners.length);

    // 4. Memberships on this LE
    const memberships = await prisma.membership.findMany({
        where: { clientLEId: leId },
        select: { id: true, userId: true, organizationId: true, role: true }
    });
    console.log("\n=== MEMBERSHIPS ON LE ===", JSON.stringify(memberships, null, 2));

    // 5. Existing common questionnaires
    const cqs = await prisma.clientLE.findUnique({
        where: { id: leId },
        select: {
            commonQuestionnaires: {
                where: { isDeleted: false },
                select: { id: true, name: true, sourceId: true, kind: true, status: true, referenceCode: true }
            }
        }
    });
    console.log("\n=== EXISTING COMMON QUESTIONNAIRES ===", JSON.stringify(cqs?.commonQuestionnaires, null, 2));

    // 6. Simulate getAvailableCommonQuestionnaires logic step by step
    console.log("\n=== SIMULATING getAvailableCommonQuestionnaires ===");

    let partyId: string | undefined;

    const owner = await (prisma.clientLEOwner as any).findFirst({
        where: { clientLEId: leId, endAt: null },
        orderBy: { startAt: 'asc' }
    });
    console.log("STEP 1 - Active owner:", owner ? `partyId=${owner.partyId}` : "NONE");

    if (owner) {
        partyId = owner.partyId;
    } else {
        const anyOwner = await (prisma.clientLEOwner as any).findFirst({
            where: { clientLEId: leId },
            orderBy: { createdAt: 'desc' }
        });
        console.log("STEP 2 - Any historical owner:", anyOwner ? `partyId=${anyOwner.partyId}` : "NONE");
        if (anyOwner) {
            partyId = anyOwner.partyId;
        } else {
            const membership = await prisma.membership.findFirst({
                where: { clientLEId: leId, organizationId: { not: null } }
            });
            console.log("STEP 3 - LE membership:", membership ? `orgId=${membership.organizationId}` : "NONE");
            if (membership?.organizationId) {
                partyId = membership.organizationId;
            }
        }
    }

    console.log("RESOLVED partyId:", partyId ?? "UNDEFINED (will fetch GLOBAL only)");

    // 7. Simulate what getDiscoverableReferenceSnapshotsForOrg returns
    const whereClause: any = {
        isDeleted: false,
        status: { not: "ARCHIVED" },
        kind: "REFERENCE_SNAPSHOT",
        OR: [
            { visibility: "GLOBAL" },
            ...(partyId ? [{
                visibility: { in: ["PRIVATE", "RESTRICTED"] },
                ownerOrgId: partyId,
            }] : []),
        ],
    };

    const snapshots = await prisma.questionnaire.findMany({
        where: whereClause,
        select: { id: true, name: true, referenceCode: true, visibility: true, ownerOrgId: true }
    });
    console.log(`\n=== DISCOVERABLE SNAPSHOTS (${snapshots.length}) ===`);
    snapshots.forEach((s: any) => console.log(`  - ${s.name} (${s.id}) vis=${s.visibility} ref=${s.referenceCode}`));

    // 8. Check FI Engagements
    const engagements = await prisma.fIEngagement.findMany({
        where: { clientLEId: leId, isDeleted: false },
        select: { id: true, fiOrgId: true, org: { select: { name: true } } }
    });
    console.log("\n=== FI ENGAGEMENTS ===", JSON.stringify(engagements, null, 2));

    // 9. Check what addCommonQuestionnaire would do - look for the template
    if (snapshots.length > 0) {
        const testSnapshotId = snapshots[0].id;
        console.log(`\n=== SIMULATING addCommonQuestionnaire for snapshot ${testSnapshotId} ===`);
        const template = await prisma.questionnaire.findUnique({
            where: { id: testSnapshotId },
            select: {
                id: true,
                name: true,
                kind: true,
                referenceCode: true,
                functionalCode: true,
                fiOrgId: true,
                isTemplate: true,
                isGlobal: true,
                _count: { select: { questions: true } }
            }
        });
        console.log("Template found:", JSON.stringify(template, null, 2));

        // Check if there's already a common questionnaire with this source
        const existing = await prisma.questionnaire.findMany({
            where: {
                sourceId: testSnapshotId,
                commonForClients: { some: { id: leId } },
                isDeleted: false
            },
            select: { id: true, name: true, referenceCode: true }
        });
        console.log("Existing instances from this source:", JSON.stringify(existing, null, 2));
    }

    // 10. Check the deployment - is this the dev branch code?
    console.log("\n=== CHECKING addCommonQuestionnaire SOURCE ===");
    const fs = require('fs');
    const sourcePath = './src/actions/client-le.ts';
    const source = fs.readFileSync(sourcePath, 'utf8');
    const getAvailFn = source.substring(
        source.indexOf('export async function getAvailableCommonQuestionnaires'),
        source.indexOf('export async function getLinkedCommonQuestionnaires')
    );
    // Check if the old "No owner found" early return is still present
    if (getAvailFn.includes('"No owner found"')) {
        console.log("WARNING: OLD CODE DETECTED - still has 'No owner found' early return!");
    } else {
        console.log("OK: New code with fallback logic is in place.");
    }
    if (getAvailFn.includes('let partyId')) {
        console.log("OK: New partyId fallback logic is present.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
