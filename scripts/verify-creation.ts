import { PrismaClient } from "@prisma/client";
import { normalizeCode, computeNextVersion } from "../src/lib/questionnaires/reference-codes";

const prisma = new PrismaClient();

async function main() {
    // 1. Setup a dummy FI Org and Client LE
    const fiOrg = await prisma.organization.upsert({
        where: { id: "test-fi-org-1" },
        update: {},
        create: { id: "test-fi-org-1", name: "Test Supplier", shortCode: "XYZUK" }
    });

    const clientLe = await prisma.clientLE.upsert({
        where: { id: "test-client-le-1" },
        update: {},
        create: { id: "test-client-le-1", name: "Test Client", shortCode: "ABCDE" }
    });

    const engagement = await prisma.fIEngagement.upsert({
        where: { id: "test-engagement-1" },
        update: {},
        create: {
            id: "test-engagement-1",
            fiOrgId: fiOrg.id,
            clientLEId: clientLe.id,
            status: "PREPARATION"
        }
    });

    // 2. Parent with Placeholder Name
    const parent1 = await prisma.questionnaire.create({
        data: {
            name: "FMSB_260606_ONPRO_XXXXX_SSSSS_v1",
            referenceCode: "FMSB_260606_ONPRO_XXXXX_SSSSS_v1",
            fiOrgId: fiOrg.id,
            kind: "REFERENCE_SNAPSHOT",
            status: "ACTIVE"
        }
    });

    // 3. Parent with Friendly Name
    const parent2 = await prisma.questionnaire.create({
        data: {
            name: "FMSB Master Questionnaire",
            referenceCode: "FMSB_260606_ONPRO_XXXXX_SSSSS_v1",
            fiOrgId: fiOrg.id,
            kind: "REFERENCE_SNAPSHOT",
            status: "ACTIVE"
        }
    });

    // --- APPLY LOGIC FOR PARENT 1 ---
    let instanceReferenceCode1 = parent1.referenceCode;
    const leCode1 = "ABCDE";
    const supCode1 = "XYZUK";
    const contextualPrefix1 = parent1.referenceCode!
        .replace(/_v\d+$/, "")
        .replace(/_(XXXXX)(?=_|$)/, `_${leCode1}`)
        .replace(/_(S{4,})(?=_|$)/, `_${supCode1}`);
    instanceReferenceCode1 = contextualPrefix1;

    let instanceName1 = parent1.name;
    if (!instanceName1 || instanceName1 === parent1.referenceCode || instanceName1.includes("XXXXX") || instanceName1.includes("SSSSS")) {
        instanceName1 = instanceReferenceCode1 || parent1.name;
    }

    const instance1 = await prisma.questionnaire.create({
        data: {
            name: instanceName1,
            referenceCode: instanceReferenceCode1,
            fiOrgId: fiOrg.id,
            fiEngagementId: engagement.id,
            kind: "ENGAGEMENT_QUESTIONNAIRE",
            sourceId: parent1.id,
            status: "ACTIVE"
        }
    });

    // --- APPLY LOGIC FOR PARENT 2 ---
    let instanceReferenceCode2 = parent2.referenceCode;
    const leCode2 = "ABCDE";
    const supCode2 = "XYZUK";
    const contextualPrefix2 = parent2.referenceCode!
        .replace(/_v\d+$/, "")
        .replace(/_(XXXXX)(?=_|$)/, `_${leCode2}`)
        .replace(/_(S{4,})(?=_|$)/, `_${supCode2}`);
    instanceReferenceCode2 = contextualPrefix2;

    let instanceName2 = parent2.name;
    if (!instanceName2 || instanceName2 === parent2.referenceCode || instanceName2.includes("XXXXX") || instanceName2.includes("SSSSS")) {
        instanceName2 = instanceReferenceCode2 || parent2.name;
    }

    const instance2 = await prisma.questionnaire.create({
        data: {
            name: instanceName2,
            referenceCode: instanceReferenceCode2,
            fiOrgId: fiOrg.id,
            fiEngagementId: engagement.id,
            kind: "ENGAGEMENT_QUESTIONNAIRE",
            sourceId: parent2.id,
            status: "ACTIVE"
        }
    });

    console.log("==================================================");
    console.log("TEST 1: Parent where name == referenceCode with placeholders");
    console.log(`Parent Name: ${parent1.name}`);
    console.log(`Parent Ref:  ${parent1.referenceCode}`);
    console.log(`-> Instance Name: ${instance1.name}`);
    console.log(`-> Instance Ref:  ${instance1.referenceCode}`);
    console.log(`-> Kind:          ${instance1.kind}`);
    console.log(`-> Source ID:     ${instance1.sourceId}`);
    console.log(`-> Engagement ID: ${instance1.fiEngagementId}`);
    console.log("");

    console.log("TEST 2: Parent with friendly name");
    console.log(`Parent Name: ${parent2.name}`);
    console.log(`Parent Ref:  ${parent2.referenceCode}`);
    console.log(`-> Instance Name: ${instance2.name}`);
    console.log(`-> Instance Ref:  ${instance2.referenceCode}`);
    console.log(`-> Kind:          ${instance2.kind}`);
    console.log(`-> Source ID:     ${instance2.sourceId}`);
    console.log(`-> Engagement ID: ${instance2.fiEngagementId}`);
    console.log("==================================================");

    // Cleanup
    await prisma.questionnaire.deleteMany({
        where: { id: { in: [parent1.id, parent2.id, instance1.id, instance2.id] } }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
