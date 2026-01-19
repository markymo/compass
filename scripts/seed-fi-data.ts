
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding FI data...');

    // 1. Create or Find FI Org
    // User reported being in "Compas System Admin". Let's try to find that, or fallback to Sovereign.
    let fiOrg = await prisma.organization.findFirst({
        where: {
            name: { contains: 'Admin', mode: 'insensitive' }
        }
    });

    if (!fiOrg) {
        fiOrg = await prisma.organization.findFirst({
            where: { name: 'Sovereign Bank' }
        });
    }

    if (!fiOrg) {
        console.log('Creating FI Org (Sovereign Bank)...');
        fiOrg = await prisma.organization.create({
            data: {
                name: 'Sovereign Bank',
                types: ['FI'],
            }
        });
    } else {
        console.log(`Found FI Org: ${fiOrg.name}`);
        // Ensure it has FI type
        if (!fiOrg.types.includes('FI')) {
            console.log("Adding FI type to org...");
            await prisma.organization.update({
                where: { id: fiOrg.id },
                data: { types: { push: 'FI' } }
            });
            // Need to reload to get new types? Actually we just need ID for next steps.
        }
    }

    // 2. Find a User to assign (assuming first found user for now, or specific email)
    const user = await prisma.user.findFirst();
    if (user) {
        // Assign to FI
        const role = await prisma.userOrganizationRole.findUnique({
            where: {
                userId_orgId: {
                    userId: user.id,
                    orgId: fiOrg.id
                }
            }
        });

        if (!role) {
            await prisma.userOrganizationRole.create({
                data: {
                    userId: user.id,
                    orgId: fiOrg.id,
                    role: 'ADMIN'
                }
            });
            console.log(`Assigned user ${user.email} to FI.`);
        }
    }

    // 3. Create Client & Engagement
    let clientOrg = await prisma.organization.findFirst({ where: { name: 'Acme Hedge Fund' } });
    if (!clientOrg) {
        clientOrg = await prisma.organization.create({
            data: { name: 'Acme Hedge Fund', types: ['CLIENT'] }
        });
    }

    let clientLE = await prisma.clientLE.findFirst({ where: { name: 'Acme Fund I, LP' } });
    if (!clientLE) {
        clientLE = await prisma.clientLE.create({
            data: {
                clientOrgId: clientOrg.id,
                name: 'Acme Fund I, LP',
                status: 'ACTIVE'
            }
        });
    }

    // Create Engagement
    let engagement = await prisma.fIEngagement.findUnique({
        where: {
            fiOrgId_clientLEId: {
                fiOrgId: fiOrg.id,
                clientLEId: clientLE.id
            }
        }
    });

    if (!engagement) {
        console.log("Creating Engagement...");
        engagement = await prisma.fIEngagement.create({
            data: {
                fiOrgId: fiOrg.id,
                clientLEId: clientLE.id,
                status: 'PENDING'
            }
        });
    }

    // 4. Create Questionnaire
    // 4. Create Questionnaire TEMPLATE
    console.log("Creating Template...");
    const template = await prisma.questionnaire.create({
        data: {
            fiOrgId: fiOrg.id,
            name: 'Wolfsberg CBDDQ (Template)',
            status: 'DRAFT',
            fileName: 'wolfsberg_v12.pdf',
            fileType: 'application/pdf',
            questions: {
                create: [
                    { text: "1. Does the entity have a documented AML policy?", order: 1 },
                    { text: "2. Is the AML policy approved by the Board?", order: 2 },
                    { text: "3. Does the entity perform adverse media screening?", order: 3 },
                    { text: "4. Are all high-risk clients subject to EDD?", order: 4 },
                    { text: "5. Provide link to latest Annual Report.", order: 5 },
                ]
            }
        },
        include: { questions: true }
    });

    // 5. Create Questionnaire INSTANCE (Simulate Assignment)
    console.log("Creating Instance (Assignment)...");
    const instance = await prisma.questionnaire.create({
        data: {
            fiOrgId: fiOrg.id,
            name: 'Wolfsberg CBDDQ', // Instance Name
            status: 'PENDING',
            fiEngagementId: engagement.id, // Linked to Engagement
            fileName: template.fileName,
            fileType: template.fileType,
            questions: {
                create: template.questions.map(q => ({
                    text: q.text,
                    order: q.order,
                    status: 'DRAFT', // Default
                    // We will update some below to simulate work
                }))
            }
        },
        include: { questions: true }
    });

    // 6. Simulate some work (Answers & Statuses)
    console.log("Simulating answers...");
    // Force Fetch or use returned include. instance.questions exists because of include: true
    const qs = (instance as any).questions.sort((a: any, b: any) => a.order - b.order);

    // Q1: Answered & In Review
    if (qs[0]) {
        await prisma.question.update({
            where: { id: qs[0].id },
            data: {
                answer: "Yes, our AML policy is documented in document ref POL-001.",
                status: 'INTERNAL_REVIEW'
            }
        });
    }

    // Q2: Draft Answer
    if (qs[1]) {
        await prisma.question.update({
            where: { id: qs[1].id },
            data: {
                answer: "Yes, approved on 2024-01-15.",
                status: 'DRAFT'
            }
        });
    }

    // Q3: Shared/Done
    if (qs[2]) {
        await prisma.question.update({
            where: { id: qs[2].id },
            data: {
                answer: "We use WorldCheck for all screening.",
                status: 'SHARED' // or DONE
            }
        });
    }

    // Q4, Q5 remain empty drafts.

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
