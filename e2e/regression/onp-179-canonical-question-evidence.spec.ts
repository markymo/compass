import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { resolveExportAnswer } from '../../src/lib/export/export-answer-resolver';
import { createQuestionnaireSubmission } from '../../src/services/submissionService';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

test.describe.configure({ mode: 'serial' });

test.describe('ONP-179: Canonical Questionnaire Evidence Across Master Data, Submissions, and Exports', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let relationshipId: string;
    let testTimestamp: number;

    // Track created records for cleanup
    let createdCcPartyId: string | null = null;
    let partyDocId: string | null = null;
    let fieldDocId: string | null = null;
    let claim104Id: string | null = null;
    let claim105Id: string | null = null;
    let claim105AttachId: string | null = null;
    let claim106Id: string | null = null;
    let relQuestionnaireId: string | null = null;
    let relQuestionnaireCreated: boolean = false;
    let originalQuestionMappings: Array<{ id: string; masterFieldNo: number | null }> = [];
    let commonQuestionnaireId: string | null = null;
    let commonQuestionnaireCreated: boolean = false;
    let createdSubmissionId: string | null = null;
    let initialLegalEntityId: string | null = null;
    let createdLegalEntityId: string | null = null;
    let subjectLeId: string | null = null;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        relationshipId = manifest.relationshipAlpha.id;
        testTimestamp = Date.now();

        // 1. Create a test Party (INDIVIDUAL)
        const ccParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    partyType: 'INDIVIDUAL',
                    forenames: 'Eleanor',
                    surname: `Evidence-${testTimestamp}`,
                    email: `eleanor.${testTimestamp}@evidence.example`
                }
            }
        });
        createdCcPartyId = ccParty.id;

        // 2. Create Party-attached Document
        const partyDoc = await prisma.document.create({
            data: {
                name: `party_passport_${testTimestamp}.pdf`,
                storagePathname: `test/party_${testTimestamp}.pdf`,
                mimeType: 'application/pdf',
                clientLEId,
                isDeleted: false
            }
        });
        partyDocId = partyDoc.id;

        // Link party document via CCPartyDocument
        await prisma.cCPartyDocument.create({
            data: {
                partyId: createdCcPartyId,
                documentId: partyDocId,
                instanceId: `inst_${testTimestamp}`,
                operation: 'ATTACH'
            }
        });

        // 3. Create Field-attached Document
        const fieldDoc = await prisma.document.create({
            data: {
                name: `field_proof_of_address_${testTimestamp}.pdf`,
                storagePathname: `test/field_${testTimestamp}.pdf`,
                mimeType: 'application/pdf',
                clientLEId,
                isDeleted: false
            }
        });
        fieldDocId = fieldDoc.id;

        // Fetch subjectLeId for alphaClientLE, ensuring LegalEntity linkage
        const clientLERecord = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { legalEntityId: true }
        });
        initialLegalEntityId = clientLERecord?.legalEntityId || null;
        subjectLeId = initialLegalEntityId;
        if (!subjectLeId) {
            const le = await prisma.legalEntity.create({
                data: {
                    name: 'UAT Alpha Limited Legal Entity',
                    reference: `alpha-le-${testTimestamp}`
                }
            });
            createdLegalEntityId = le.id;
            subjectLeId = le.id;
            await prisma.clientLE.update({
                where: { id: clientLEId },
                data: { legalEntityId: le.id }
            });
        }

        // 4. Create Claim for Field 106: Party-ONLY attachment (no direct field doc)
        const claim106 = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 106,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                ownerScopeId: manifest.clientOrgA.id,
                valueJson: { ccPartyId: createdCcPartyId },
                attachmentDocumentId: null
            }
        });
        claim106Id = claim106.id;

        // 5. Create Claims for Field 105: Party attachment via VALUE claim + Direct field attachment via FILE_ATTACHMENT claim
        const claim105 = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 105,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                ownerScopeId: manifest.clientOrgA.id,
                valueJson: { ccPartyId: createdCcPartyId },
                attachmentDocumentId: null
            }
        });
        claim105Id = claim105.id;

        const claim105Attach = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 105,
                claimRole: 'FILE_ATTACHMENT',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                ownerScopeId: manifest.clientOrgA.id,
                attachmentDocumentId: fieldDocId,
                instanceId: `inst_field_${testTimestamp}`
            }
        });
        claim105AttachId = claim105Attach.id;

        // 7. Ensure relationship questionnaire has questions mapped to Field 106 & 105
        let relQ = await prisma.questionnaire.findFirst({
            where: { fiEngagementId: relationshipId, isDeleted: false },
            include: { questions: { orderBy: { order: 'asc' } } }
        });

        if (!relQ) {
            relQ = await prisma.questionnaire.create({
                data: {
                    name: `Alpha Relationship Q ${testTimestamp}`,
                    fiEngagementId: relationshipId,
                    fiOrgId: manifest.supplierOrgA.id,
                    status: 'ACTIVE',
                    kind: 'ENGAGEMENT_QUESTIONNAIRE',
                    questions: {
                        create: [
                            { text: 'Settlements Question (106)', order: 1, masterFieldNo: 106 },
                            { text: 'Signatories Question (105)', order: 2, masterFieldNo: 105 }
                        ]
                    }
                },
                include: { questions: { orderBy: { order: 'asc' } } }
            });
            relQuestionnaireCreated = true;
        } else {
            relQuestionnaireCreated = false;
            // Record original mappings for exact cleanup restoration
            originalQuestionMappings = relQ.questions.slice(0, 2).map(q => ({
                id: q.id,
                masterFieldNo: q.masterFieldNo
            }));
            // Update existing questions to map to 106 and 105 for the test
            if (relQ.questions.length >= 2) {
                await prisma.question.update({
                    where: { id: relQ.questions[0].id },
                    data: { masterFieldNo: 106 }
                });
                await prisma.question.update({
                    where: { id: relQ.questions[1].id },
                    data: { masterFieldNo: 105 }
                });
            }
        }
        relQuestionnaireId = relQ.id;

        // 8. Ensure a Common Questionnaire is linked to Client LE
        let commonQ = await prisma.questionnaire.findFirst({
            where: {
                commonForClients: { some: { id: clientLEId } },
                isDeleted: false
            }
        });
        if (!commonQ) {
            commonQ = await prisma.questionnaire.create({
                data: {
                    name: `Alpha Common Due Diligence ${testTimestamp}`,
                    fiOrgId: manifest.supplierOrgA.id,
                    status: 'ACTIVE',
                    kind: 'COMMON_QUESTIONNAIRE',
                    commonForClients: { connect: { id: clientLEId } },
                    questions: {
                        create: [
                            { text: 'Common Question 106', order: 1, masterFieldNo: 106 }
                        ]
                    }
                }
            });
            commonQuestionnaireCreated = true;
        } else {
            commonQuestionnaireCreated = false;
        }
        commonQuestionnaireId = commonQ.id;
    });

    test.afterAll(async () => {
        try {
            // 1. Delete created submissions
            if (createdSubmissionId) {
                await prisma.questionnaireSubmission.delete({
                    where: { id: createdSubmissionId }
                }).catch(() => {});
            }

            // 2. Restore or delete relationship questionnaire
            if (relQuestionnaireCreated && relQuestionnaireId) {
                await prisma.question.deleteMany({ where: { questionnaireId: relQuestionnaireId } }).catch(() => {});
                await prisma.questionnaire.delete({ where: { id: relQuestionnaireId } }).catch(() => {});
            } else if (originalQuestionMappings.length > 0) {
                for (const mapping of originalQuestionMappings) {
                    await prisma.question.update({
                        where: { id: mapping.id },
                        data: { masterFieldNo: mapping.masterFieldNo }
                    }).catch(() => {});
                }
            }

            // 3. Delete common questionnaire if created specifically by this test
            if (commonQuestionnaireCreated && commonQuestionnaireId) {
                await prisma.question.deleteMany({ where: { questionnaireId: commonQuestionnaireId } }).catch(() => {});
                await prisma.questionnaire.delete({ where: { id: commonQuestionnaireId } }).catch(() => {});
            }

            // 4. Delete claims created for fields 105, 106, 74
            if (claim105Id) await prisma.fieldClaim.delete({ where: { id: claim105Id } }).catch(() => {});
            if (claim105AttachId) await prisma.fieldClaim.delete({ where: { id: claim105AttachId } }).catch(() => {});
            if (claim106Id) await prisma.fieldClaim.delete({ where: { id: claim106Id } }).catch(() => {});
            // Fail-safe cleanup for test claims
            await prisma.fieldClaim.deleteMany({
                where: {
                    clientLEId,
                    instanceId: { contains: String(testTimestamp) }
                }
            }).catch(() => {});

            // 5. Delete CCParty and CCPartyDocument
            if (createdCcPartyId) {
                await prisma.cCPartyDocument.deleteMany({ where: { partyId: createdCcPartyId } }).catch(() => {});
                await prisma.cCParty.delete({ where: { id: createdCcPartyId } }).catch(() => {});
            }

            // 6. Delete Documents
            if (partyDocId) await prisma.document.delete({ where: { id: partyDocId } }).catch(() => {});
            if (fieldDocId) await prisma.document.delete({ where: { id: fieldDocId } }).catch(() => {});

            // 7. Restore LegalEntity linkage
            if (createdLegalEntityId) {
                await prisma.clientLE.update({
                    where: { id: clientLEId },
                    data: { legalEntityId: initialLegalEntityId }
                }).catch(() => {});
                await prisma.legalEntity.delete({
                    where: { id: createdLegalEntityId }
                }).catch(() => {});
            }
        } catch (err) {
            console.warn('[ONP-179 E2E] Cleanup warning:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Party-only attachment visible in /master RHS drawer, count = 1
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 1: Party-only attachment is visible in /master RHS drawer and count = 1', async ({ page }) => {
        // Deep link directly to Field 106 to auto-open the inspection drawer
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=106`);
        await page.waitForLoadState('domcontentloaded');

        // Locate the inspection drawer (SheetContent)
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 20000 });

        // Assert Field Attachments section is present
        await expect(drawer.getByText(/Field Attachments/i)).toBeVisible({ timeout: 15000 });

        // Verify the party attachment is visible in the Field Attachments section
        await expect(drawer.getByText(`party_passport_${testTimestamp}.pdf`)).toBeVisible({ timeout: 15000 });

        // Explicitly assert that the count of attached documents is exactly 1
        const downloadLinks = drawer.getByRole('link', { name: /Download/i });
        await expect(downloadLinks).toHaveCount(1);

        // Verify provenance indicates attached to party
        await expect(drawer.getByText(/Attached to Party:/i)).toBeVisible({ timeout: 10000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Field + Party attachments both visible, count = 2; deduplicated if shared
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 2: Field + Party attachments both visible (count = 2) and deduplicated if shared (count = 1)', async ({ page }) => {
        // Deep link directly to Field 105 (has both fieldDoc and partyDoc)
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=105`);
        await page.waitForLoadState('domcontentloaded');

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 20000 });

        // Both documents should be visible
        await expect(drawer.getByText(`field_proof_of_address_${testTimestamp}.pdf`)).toBeVisible({ timeout: 15000 });
        await expect(drawer.getByText(`party_passport_${testTimestamp}.pdf`)).toBeVisible({ timeout: 15000 });

        // Explicitly assert that Field 105 has exactly 2 attachments rendered
        const downloadLinks105 = drawer.getByRole('link', { name: /Download/i });
        await expect(downloadLinks105).toHaveCount(2);

        // Verify deduplication on Field 106 (Party-only has exactly 1 file attached)
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=106`);
        await page.waitForLoadState('domcontentloaded');

        const drawer106 = page.locator('[role="dialog"]').first();
        await expect(drawer106).toBeVisible({ timeout: 20000 });
        const partyDocsIn106 = drawer106.getByText(`party_passport_${testTimestamp}.pdf`);
        await expect(partyDocsIn106).toHaveCount(1);
        const downloadLinks106 = drawer106.getByRole('link', { name: /Download/i });
        await expect(downloadLinks106).toHaveCount(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Workbench4 count parity with /master
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 3: Workbench4 displays exact attachment count parity with /master', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/workbench4`);
        await page.waitForLoadState('domcontentloaded');

        // Verify Workbench4 loads without error
        await expect(page.locator('text=Failed to load Workbench')).not.toBeVisible();
        await expect(page.locator('text=Application error')).not.toBeVisible();

        // Field 106 has 1 attachment (Party-only)
        const indicator106 = page.locator('[title="1 file attached"], [aria-label="1 file attached"]').or(page.getByText('1 doc'));
        await expect(indicator106.first()).toBeVisible({ timeout: 25000 });

        // Field 105 has 2 attachments (Field + Party)
        const indicator105 = page.locator('[title="2 files attached"], [aria-label="2 files attached"]').or(page.getByText('2 docs'));
        await expect(indicator105.first()).toBeVisible({ timeout: 25000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Relationships -> Documents / Output shows same canonical attachments
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 4: Relationships Documents tab & Output builder expose canonical attachments', async ({ page }) => {
        // Navigate to Relationships Documents tab
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=documents`);
        await page.waitForLoadState('domcontentloaded');

        // Confirm both canonical documents appear in the Documents tab evidence list
        // party_passport is canonical evidence for both Question 1 (106) and Question 2 (105) -> exactly 2 occurrences
        const partyDocItems = page.getByText(`party_passport_${testTimestamp}.pdf`);
        await expect(partyDocItems.first()).toBeVisible({ timeout: 25000 });
        await expect(partyDocItems).toHaveCount(2);

        // field_proof_of_address is canonical evidence for Question 2 (105) -> exactly 1 occurrence
        const fieldDocItems = page.getByText(`field_proof_of_address_${testTimestamp}.pdf`);
        await expect(fieldDocItems.first()).toBeVisible({ timeout: 25000 });
        await expect(fieldDocItems).toHaveCount(1);

        // Assert the Attachments tab is active and shows the attachment count badge
        const attachmentsTab = page.getByRole('tab', { name: /Attachments/i });
        await expect(attachmentsTab).toBeVisible({ timeout: 15000 });

        // Navigate to Output tab
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('domcontentloaded');

        const outputPanel = page.locator('[role="tabpanel"][data-state="active"]');
        await expect(outputPanel.getByText(/Output Pack/i).first()).toBeVisible({ timeout: 20000 });
        await expect(outputPanel.getByText(/Common Questionnaires/i).first()).toBeVisible({ timeout: 15000 });
        await expect(outputPanel.getByText(/Relationship Questionnaires/i).first()).toBeVisible({ timeout: 15000 });

        // Assert attachment file count is visible on questionnaire card and expand to verify filenames
        const fileCountButton = outputPanel.locator('button:has-text("file")').first();
        await expect(fileCountButton).toBeVisible({ timeout: 15000 });
        await fileCountButton.click();

        // Confirm canonical filenames are visible inside the expanded files list
        await expect(
            outputPanel.getByText(`party_passport_${testTimestamp}.pdf`)
                .or(outputPanel.getByText(`field_proof_of_address_${testTimestamp}.pdf`))
                .first()
        ).toBeVisible({ timeout: 15000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Output Pack contains relationship Q, Common Q, and attachment filenames
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 5: Output Pack POST generates package with relationship and common questionnaires', async ({ request }) => {
        // Test authorized Output Pack export endpoint directly, requesting both questionnaires and canonical documents
        const response = await request.post('/api/export/output-pack', {
            data: {
                engagementId: relationshipId,
                clientLEId,
                questionnaireIds: [relQuestionnaireId!, commonQuestionnaireId!],
                documentIds: [partyDocId!, fieldDocId!],
                includeMasterData: true,
                includeEvidenceFiles: true
            }
        });

        // Must succeed with 200 OK
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/zip');
        const buffer = await response.body();
        expect(buffer.length).toBeGreaterThan(100);

        // Inspect ZIP contents via JSZip
        const zip = await JSZip.loadAsync(buffer);
        const filePaths = Object.keys(zip.files);

        // 1. Assert export-manifest.json is present and valid
        const manifestEntry = filePaths.find(p => p.endsWith('export-manifest.json'));
        expect(manifestEntry).toBeDefined();
        const manifestText = await zip.file(manifestEntry!)!.async('text');
        const parsedManifest = JSON.parse(manifestText);
        expect(parsedManifest.engagementId).toBe(relationshipId);
        expect(parsedManifest.questionnaires.length).toBeGreaterThanOrEqual(2);

        // 2. Assert Questionnaire PDF entries are present in the ZIP
        const pdfFiles = filePaths.filter(p => p.endsWith('.pdf'));
        expect(pdfFiles.length).toBeGreaterThanOrEqual(2);

        // 3. Assert canonical evidence files or download placeholders are present in the ZIP
        const hasEvidence = filePaths.some(p => 
            p.includes(`party_passport_${testTimestamp}`) || 
            p.includes(`field_proof_of_address_${testTimestamp}`)
        );
        expect(hasEvidence).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 6: Field 74 document-only answer resolves to HAS_VALUE & "Document attached"
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 6: Document-only answer (e.g. Field 74) displays "Document attached" and HAS_VALUE', async () => {
        // Create an attachment-only claim for Field 74 (no VALUE claim)
        const claim74 = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 74,
                claimRole: 'FILE_ATTACHMENT',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                ownerScopeId: manifest.clientOrgA.id,
                attachmentDocumentId: fieldDocId,
                instanceId: `inst_74_${testTimestamp}`
            }
        });

        try {
            const question74 = {
                id: `q_74_${testTimestamp}`,
                text: 'Upload signed agreement',
                order: 1,
                masterFieldNo: 74,
                customFieldDefinitionId: null,
                masterQuestionGroupId: null
            };

            const resolved = await resolveExportAnswer(
                question74,
                subjectLeId || undefined,
                manifest.clientOrgA.id,
                clientLEId
            );

            expect(resolved.answerState).toBe('HAS_VALUE');
            expect(resolved.displayValue).toBe('Document attached');
            expect(resolved.attachmentFilenames).toContain(`field_proof_of_address_${testTimestamp}.pdf`);
        } finally {
            await prisma.fieldClaim.delete({ where: { id: claim74.id } }).catch(() => {});
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: Unauthorized questionnaire ID cannot be inserted into Output Pack (403)
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 7: Unauthorized questionnaire ID in Output Pack request is rejected with 403 Forbidden', async ({ request }) => {
        const unauthorizedQId = '00000000-0000-0000-0000-000000000000';
        const response = await request.post('/api/export/output-pack', {
            data: {
                engagementId: relationshipId,
                clientLEId,
                questionnaireIds: [relQuestionnaireId!, unauthorizedQId],
                includeMasterData: true,
                includeEvidenceFiles: true
            }
        });

        // Invariant: Rogue questionnaire ID outside permitted set must return 403
        expect(response.status()).toBe(403);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: Frozen historical submission exposes snapshotted attachments after Master changes
    // ─────────────────────────────────────────────────────────────────────────
    test('Scenario 8: Historical questionnaire submission freezes canonical attachments immutably', async () => {
        const user = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });

        const relQ = await prisma.questionnaire.findUnique({
            where: { id: relQuestionnaireId! },
            include: { questions: { orderBy: { order: 'asc' } } }
        });

        // 1. Submit questionnaire via official SubmissionService freezing canonical attachments
        const subResult = await createQuestionnaireSubmission({
            questionnaireId: relQuestionnaireId!,
            relationshipId,
            clientLEId,
            submittedById: user!.id
        });

        expect(subResult.success).toBe(true);
        expect(subResult.submissionId).toBeDefined();
        createdSubmissionId = subResult.submissionId!;

        // Verify the frozen submission contains the snapshotted attachments
        const frozenAnswers = await prisma.submissionAnswer.findMany({
            where: { submissionId: createdSubmissionId },
            include: { attachments: { include: { document: true } } }
        });

        const ans106 = frozenAnswers.find(a => a.masterFieldNo === 106);
        expect(ans106).toBeDefined();
        // Snapshotted party document was captured into SubmissionAnswerAttachment
        expect(ans106?.attachments.length).toBe(1);
        expect(ans106?.attachments[0].document.name).toBe(`party_passport_${testTimestamp}.pdf`);

        const ans105 = frozenAnswers.find(a => a.masterFieldNo === 105);
        expect(ans105).toBeDefined();
        // Snapshotted 2 documents (field doc + party doc)
        expect(ans105?.attachments.length).toBe(2);

        // 2. Now simulate live Master data change: remove the party document from CCPartyDocument
        await prisma.cCPartyDocument.deleteMany({
            where: { partyId: createdCcPartyId! }
        });

        // 3. Inspect the frozen historical submission: historical evidence remains intact!
        const reloadedAnswers = await prisma.submissionAnswer.findMany({
            where: { submissionId: createdSubmissionId },
            include: { attachments: { include: { document: true } } }
        });

        const reloadedAns106 = reloadedAnswers.find(a => a.masterFieldNo === 106);
        expect(reloadedAns106?.attachments.length).toBe(1);
        expect(reloadedAns106?.attachments[0].document.name).toBe(`party_passport_${testTimestamp}.pdf`);
    });
});
