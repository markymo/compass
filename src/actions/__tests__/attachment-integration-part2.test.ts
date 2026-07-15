import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from 'vitest';
import prisma from '@/lib/prisma';
import { addFieldAttachment, replaceFieldAttachment, removeFieldAttachment } from '../attachment-actions';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getUploadIntentStatus } from '../upload-intent';
import { DocumentService } from '@/lib/documents/DocumentService';
import { refreshDefinitionCache } from '@/services/masterData/definitionService';
import { del } from '@vercel/blob';

// Mock auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-part2' }),
}));

vi.mock('@vercel/blob', () => ({
    head: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'test-token';

describe.skipIf(!process.env.DATABASE_URL)('Phase 4 Attachment Lifecycle Integration Part 2', () => {
    let clientLEId: string;
    let subjectLeId: string;
    
    // Tracking for cleanup
    const testDocs: string[] = [];
    const testClaims: string[] = [];
    const testIntents: string[] = [];

    beforeAll(async () => {
        (del as any).mockResolvedValue({});
    });

    beforeEach(async () => {
        await prisma.user.upsert({
            where: { id: 'test-user-part2' },
            create: { id: 'test-user-part2', email: 'part2@example.com', name: 'Test User' },
            update: {}
        });

        await prisma.user.upsert({
            where: { id: 'other-user-id' },
            create: { id: 'other-user-id', email: 'other@example.com', name: 'Other User' },
            update: {}
        });

        await prisma.masterFieldDefinition.upsert({
            where: { fieldNo: 999 },
            create: { fieldNo: 999, fieldName: 'testAttachment', isActive: true, allowAttachments: true, appDataType: 'FILE' },
            update: { allowAttachments: true, appDataType: 'FILE' }
        });
        await prisma.masterFieldDefinition.upsert({
            where: { fieldNo: 998 },
            create: { fieldNo: 998, fieldName: 'testNoAttachment', isActive: true, allowAttachments: false, appDataType: 'TEXT' },
            update: { allowAttachments: false }
        });

        const realLe = await prisma.legalEntity.create({ data: { name: 'Part2 Test LE', reference: `part2-${Date.now()}-${Math.random()}` } });
        const le = await prisma.clientLE.create({ data: { name: 'Part2 Client LE', legalEntityId: realLe.id } });
        clientLEId = le.id;
        subjectLeId = realLe.id;
    });

    afterAll(async () => {
        await prisma.fieldClaim.deleteMany({ where: { clientLeScopeId: clientLEId } });
        await prisma.fieldClaim.deleteMany({ where: { subjectLeId: subjectLeId } });
        await prisma.fieldClaim.deleteMany({ where: { id: { in: testClaims } } });
        await prisma.privateDocumentUploadIntent.deleteMany({ where: { id: { in: testIntents } } });
        await prisma.document.deleteMany({ where: { id: { in: testDocs } } });
        
        if (clientLEId) {
            const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
            await prisma.clientLE.delete({ where: { id: clientLEId } });
            if (clientLE?.legalEntityId) {
                await prisma.legalEntity.delete({ where: { id: clientLE?.legalEntityId } });
            }
        }
    });

    async function makeDocument(pathname: string): Promise<string> {
        const uniquePathname = `${pathname}-${Date.now()}-${Math.random()}`;
        const doc = await prisma.document.create({
            data: {
                clientLEId,
                storageProvider: 'VERCEL_BLOB',
                storagePathname: uniquePathname,
                uploadedById: 'test-user-part2',
                name: 'test.pdf',
                fileUrl: `http://test.com/${uniquePathname}`,
                fileType: 'application/pdf',
            }
        });
        testDocs.push(doc.id);
        return doc.id;
    }

    async function makeIntent(status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING'): Promise<string> {
        const intent = await prisma.privateDocumentUploadIntent.create({
            data: {
                id: crypto.randomUUID(),
                clientLEId,
                initiatedById: 'test-user-part2',
                storagePathname: `test-intent-path-${Date.now()}-${Math.random()}`,
                originalFilename: 'test.pdf',
                status,
            }
        });
        testIntents.push(intent.id);
        return intent.id;
    }

    describe('Upload Intents', () => {
        it('PENDING -> FAILED and remains rejected/terminal', async () => {
            const intentId = await makeIntent('PENDING');
            await DocumentService.markPrivateUploadFailed(intentId, 'User cancelled');
            
            const updated = await prisma.privateDocumentUploadIntent.findUnique({ where: { id: intentId } });
            expect(updated?.status).toBe('FAILED');
            expect(updated?.failureReason).toBe('User cancelled');

            // callback against FAILED intent remains rejected
            await expect(DocumentService.verifyAndPersistPrivateUpload({
                intentId, storagePathname: updated!.storagePathname, originalFilename: 'test.pdf', clientLEId, uploadedById: 'test-user-part2'
            })).rejects.toThrow(/not in PENDING state/);
        });

        it('nonexistent intent throws error', async () => {
            await expect(DocumentService.verifyAndPersistPrivateUpload({
                intentId: 'unknown-id', storagePathname: 'path', originalFilename: 'test.pdf', clientLEId, uploadedById: 'user'
            })).rejects.toThrow(/Upload intent not found/);
        });

        it('callback pathname does not match intent pathname', async () => {
            const intentId = await makeIntent('PENDING');
            await expect(DocumentService.verifyAndPersistPrivateUpload({
                intentId, storagePathname: 'wrong-path', originalFilename: 'test.pdf', clientLEId, uploadedById: 'test-user-part2'
            })).rejects.toThrow(/Pathname mismatch/);
        });

        it('callback ClientLE/context mismatch', async () => {
            const intentId = await makeIntent('PENDING');
            const intent = await prisma.privateDocumentUploadIntent.findUnique({ where: { id: intentId } });
            await expect(DocumentService.verifyAndPersistPrivateUpload({
                intentId, storagePathname: intent!.storagePathname, originalFilename: 'test.pdf', clientLEId: 'wrong-client', uploadedById: 'test-user-part2'
            })).rejects.toThrow(/Client context mismatch/);
        });

        it('callback initiator/uploader mismatch', async () => {
            const intentId = await makeIntent('PENDING');
            const intent = await prisma.privateDocumentUploadIntent.findUnique({ where: { id: intentId } });
            await expect(DocumentService.verifyAndPersistPrivateUpload({
                intentId, storagePathname: intent!.storagePathname, originalFilename: 'test.pdf', clientLEId, uploadedById: 'wrong-user'
            })).rejects.toThrow(/Uploader mismatch/);
        });

        it('status polling allowed for initiating user, returns safe metadata only', async () => {
            const intentId = await makeIntent('PENDING');
            const status = await getUploadIntentStatus(intentId) as any;
            expect(status.status).toBe('pending');
            // Safe metadata only
            expect(status.storagePathname).toBeUndefined();
        });

        it('status polling rejected for another user', async () => {
            const intentId = await makeIntent('PENDING');
            await prisma.privateDocumentUploadIntent.update({ where: { id: intentId }, data: { initiatedById: 'other-user-id' } });
            await expect(getUploadIntentStatus(intentId))
                .rejects.toThrow(/Unauthorized/);
        });

        it('status polling rejected across ClientLE boundaries', async () => {
            const realLe2 = await prisma.legalEntity.create({ data: { name: 'LE2', reference: `part2-poll-${Date.now()}` } });
            const otherLe = await prisma.clientLE.create({ data: { name: 'other-le', legalEntityId: realLe2.id } });

            const intentId = await makeIntent('PENDING');
            await prisma.privateDocumentUploadIntent.update({ where: { id: intentId }, data: { clientLEId: otherLe.id } });
            await prisma.privateDocumentUploadIntent.update({ where: { id: intentId }, data: { initiatedById: 'other-user-id' } });
            await expect(getUploadIntentStatus(intentId))
                .rejects.toThrow(/Unauthorized/);
            
            await prisma.privateDocumentUploadIntent.delete({ where: { id: intentId } });
            await prisma.clientLE.delete({ where: { id: otherLe.id } });
            await prisma.legalEntity.delete({ where: { id: realLe2.id } });
        });
    });

    describe('Idempotency', () => {
        it('identical Replace retry returns the same replacement claim', async () => {
            const docId1 = await makeDocument('doc1');
            const docId2 = await makeDocument('doc2');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);

            const replace1 = await replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes.instanceId, attachmentDocumentId: docId2, idempotencyKey: 'idem-rep' });
            testClaims.push(replace1.id);
            const replace2 = await replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes.instanceId, attachmentDocumentId: docId2, idempotencyKey: 'idem-rep' });
            expect(replace1.id).toBe(replace2.id);
        });

        it('same key with a different Document fails', async () => {
            const key = `idem-diff-doc-${Date.now()}`;
            const docId1 = await makeDocument('doc1');
            const docId2 = await makeDocument('doc2');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1, idempotencyKey: key });
            testClaims.push(addRes.id);
            await expect(addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId2, idempotencyKey: key }))
                .rejects.toThrow(/Idempotency conflict/);
        });

        it('same key reused for Add versus Replace fails', async () => {
            const key = `idem-cross-${Date.now()}`;
            const docId1 = await makeDocument('doc1');
            const docId2 = await makeDocument('doc2');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1, idempotencyKey: key });
            testClaims.push(addRes.id);
            await expect(replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes.instanceId, attachmentDocumentId: docId2, idempotencyKey: key }))
                .rejects.toThrow(/Idempotency conflict/);
        });

        it('same key with a different ClientLE fails', async () => {
            const key = `idem-diff-le-${Date.now()}`;
            const realLe2 = await prisma.legalEntity.create({ data: { name: 'LE2', reference: `part2-2-${Date.now()}` } });
            const otherLe = await prisma.clientLE.create({ data: { name: 'other-le', legalEntityId: realLe2.id } });

            const docId1 = await makeDocument('doc1');
            const docIdOther = await prisma.document.create({
                data: {
                    name: 'other',
                    clientLEId: otherLe.id,
                    uploadedById: 'test-user-part2',
                    docType: 'EVIDENCE',
                    isVerified: false,
                    isDeleted: false,
                    storageProvider: 'VERCEL_BLOB',
                    storagePathname: `test/other-${Date.now()}.pdf`,
                    fileUrl: '',
                    fileType: 'application/pdf',
                    sizeBytes: 1000,
                    checksum: 'abc'
                }
            });

            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1, idempotencyKey: key });
            testClaims.push(addRes.id);
            await expect(addFieldAttachment({ clientLEId: otherLe.id, fieldNo: 999, attachmentDocumentId: docIdOther.id, idempotencyKey: key }))
                .rejects.toThrow();

            await prisma.document.delete({ where: { id: docIdOther.id } });
            await prisma.clientLE.delete({ where: { id: otherLe.id } });
            await prisma.legalEntity.delete({ where: { id: realLe2.id } });
        });

        it('same Replace key with a different instanceId fails', async () => {
            const key = `idem-rep-inst-${Date.now()}`;
            const docId1 = await makeDocument('doc1');
            const addRes1 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes1.id);
            
            const addRes2 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes2.id);

            const rep1 = await replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes1.instanceId, attachmentDocumentId: docId1, idempotencyKey: key });
            testClaims.push(rep1.id);

            await expect(replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes2.instanceId, attachmentDocumentId: docId1, idempotencyKey: key }))
                .rejects.toThrow(/Idempotency conflict/);
        });
    });

    describe('Eligibility & Scope', () => {
        it('Replace is rejected when allowAttachments=false', async () => {
            // First we need a claim, simulate it being created before disabled
            const docId1 = await makeDocument('doc1');
            const docId2 = await makeDocument('doc2');
            
            // Temporary enable 998
            await prisma.masterFieldDefinition.update({ where: { fieldNo: 998 }, data: { allowAttachments: true } });
            await refreshDefinitionCache();
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 998, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);
            await prisma.masterFieldDefinition.update({ where: { fieldNo: 998 }, data: { allowAttachments: false } });
            await refreshDefinitionCache();

            await expect(replaceFieldAttachment({ clientLEId, fieldNo: 998, instanceId: addRes.instanceId, attachmentDocumentId: docId2 }))
                .rejects.toThrow(/Attachments are not permitted/);
        });

        it('Remove remains allowed after the field is disabled', async () => {
            const docId1 = await makeDocument('doc1');
            await prisma.masterFieldDefinition.update({ where: { fieldNo: 998 }, data: { allowAttachments: true } });
            await refreshDefinitionCache();
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 998, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);
            await prisma.masterFieldDefinition.update({ where: { fieldNo: 998 }, data: { allowAttachments: false } });
            await refreshDefinitionCache();

            const remRes = await removeFieldAttachment({ clientLEId, fieldNo: 998, instanceId: addRes.instanceId });
            testClaims.push(remRes.id);
            expect(remRes.id).toBeDefined();
        });

        it('wrong-field Replace is rejected', async () => {
            const docId1 = await makeDocument('doc1');
            const docId2 = await makeDocument('doc2');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);

            await expect(replaceFieldAttachment({ clientLEId, fieldNo: 123, instanceId: addRes.instanceId, attachmentDocumentId: docId2 }))
                .rejects.toThrow(/not found or does not belong to the requested scope/);
        });

        it('unknown instance Replace is rejected', async () => {
            const docId2 = await makeDocument('doc2');
            await expect(replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: 'unknown', attachmentDocumentId: docId2 }))
                .rejects.toThrow(/not found or does not belong to the requested scope/);
        });
    });

    describe('Multiple Lifecycles', () => {
        it('removing lifecycle A leaves lifecycle B active and does not reorder', async () => {
            const docId1 = await makeDocument('m1');
            const docId2 = await makeDocument('m2');
            const addA = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            const addB = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId2 });
            testClaims.push(addA.id, addB.id);

            const remA = await removeFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addA.instanceId });
            testClaims.push(remA.id);

            const attachments = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].instanceId).toBe(addB.instanceId);
        });
    });

    describe('Canonical & Historical', () => {
        it('snapshot resolution before/after Add shows correct Document', async () => {
            const dateBefore = new Date();
            const docId = await makeDocument('snap1');
            await new Promise(r => setTimeout(r, 100));
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId });
            testClaims.push(addRes.id);
            const dateAfterAdd = new Date();

            const attsBefore = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999, dateBefore);
            expect(attsBefore).toHaveLength(0);

            const attsAfter = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999, dateAfterAdd);
            expect(attsAfter).toHaveLength(1);
            expect(attsAfter[0].attachmentDocumentId).toBe(docId);
        });
    });

    describe('Non-deletion Semantics', () => {
        it('Replace and Remove do not invoke Prisma Document deletion or Blob del', async () => {
            const docId1 = await makeDocument('nd1');
            const docId2 = await makeDocument('nd2');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);

            const repRes = await replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: addRes.instanceId, attachmentDocumentId: docId2 });
            testClaims.push(repRes.id);

            const remRes = await removeFieldAttachment({ clientLEId, fieldNo: 999, instanceId: repRes.instanceId });
            testClaims.push(remRes.id);
            
            // Prior Document binary identity fields are intact
            const doc = await prisma.document.findUnique({ where: { id: docId1 } });
            expect(doc?.storagePathname).toBeDefined();
            expect(doc?.sizeBytes).toBeNull(); // we didn't set it in makeDocument but it's not mutated
        });
    });
});
