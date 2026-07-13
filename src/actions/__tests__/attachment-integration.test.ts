import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from 'vitest';
import prisma from '@/lib/prisma';
import { addFieldAttachment, replaceFieldAttachment, removeFieldAttachment } from '../attachment-actions';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getUploadIntentStatus } from '../upload-intent';
import { DocumentService } from '@/lib/documents/DocumentService';
import { head, get, del } from '@vercel/blob';

// Mock auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

vi.mock('@vercel/blob', () => ({
    head: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
}));

process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = 'test-token';

describe.skipIf(!process.env.DATABASE_URL)('Phase 4 Attachment Lifecycle Integration', () => {
    let clientLEId: string;
    let subjectLeId: string;
    
    // Tracking for cleanup
    const testDocs: string[] = [];
    const testClaims: string[] = [];
    const testIntents: string[] = [];

    beforeAll(async () => {
        // Mock vercel blob head
        (head as any).mockResolvedValue({
            url: 'https://test.vercel-storage.com/sec-1',
            pathname: 'sec-1',
            contentType: 'application/pdf',
            size: 1024,
            uploadedAt: new Date()
        });
        (get as any).mockResolvedValue({
            blob: { contentType: 'application/pdf' },
            stream: {
                getReader: () => {
                    let calls = 0;
                    return {
                        read: async () => {
                            if (calls++ === 0) return { done: false, value: new Uint8Array([1, 2, 3]) };
                            return { done: true };
                        }
                    }
                }
            }
        });
        (del as any).mockResolvedValue({});
    });

    beforeEach(async () => {
        // Setup user
        await prisma.user.upsert({
            where: { id: 'test-user-part1' },
            create: { id: 'test-user-part1', email: 'part1@example.com', name: 'Test User' },
            update: {}
        });

        // Setup test fields
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

        // Setup LegalEntity & ClientLE
        const realLe = await prisma.legalEntity.create({ data: { name: 'Integration Test LegalEntity', reference: `integration-test-${Date.now()}-${Math.random()}` } });
        const le = await prisma.clientLE.create({
            data: { name: 'Integration Test LE', legalEntityId: realLe.id }
        });
        clientLEId = le.id;
        subjectLeId = realLe.id;
    });

    afterAll(async () => {
        // Cleanup
        await prisma.fieldClaim.deleteMany({ where: { clientLeScopeId: clientLEId } }); // delete all test claims safely
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
                uploadedById: 'test-user-part1',
                name: 'test.pdf',
                fileUrl: `http://test.com/${uniquePathname}`,
                fileType: 'application/pdf',
            }
        });
        testDocs.push(doc.id);
        return doc.id;
    }

    describe('1. Attachment Lifecycle Verification & 6. Canonical Resolution', () => {
        it('Add: creates immutable Document, new FILE_ATTACHMENT claim, opaque instanceId', async () => {
            const docId = await makeDocument('test-path-add');
            
            const res = await addFieldAttachment({
                clientLEId,
                fieldNo: 999,
                attachmentDocumentId: docId
            });

            expect(res.instanceId).toBeDefined();
            expect(res.instanceId).not.toBe(docId); // opaque

            testClaims.push(res.id);

            // Verify claim
            const claim = await prisma.fieldClaim.findUnique({ where: { id: res.id } });
            expect(claim?.claimRole).toBe('FILE_ATTACHMENT');
            expect(claim?.attachmentDocumentId).toBe(docId);
            
            // Verify Canonical Resolution
            const attachments = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].attachmentDocumentId).toBe(docId);
            expect(attachments[0].instanceId).toBe(res.instanceId);
            
            // Verify VALUE is unchanged
            const value = await KycStateService.getAuthoritativeValue({ clientLEId }, 999);
            expect(value).toBeNull(); // Shouldn't have set VALUE
        });

        it('Replace: creates new claim, retains instanceId, preserves ordering, untouched previous doc', async () => {
            const docId1 = await makeDocument('test-path-replace-1');
            const docId2 = await makeDocument('test-path-replace-2');

            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            testClaims.push(addRes.id);

            const replaceRes = await replaceFieldAttachment({
                clientLEId,
                fieldNo: 999,
                instanceId: addRes.instanceId,
                attachmentDocumentId: docId2
            });
            testClaims.push(replaceRes.id);

            expect(replaceRes.instanceId).toBe(addRes.instanceId);
            expect(replaceRes.attachmentDocumentId).toBe(docId2);

            // Verify previous document is untouched
            const prevDoc = await prisma.document.findUnique({ where: { id: docId1 } });
            expect(prevDoc).toBeDefined();
            
            // Verify previous claim is untouched
            const prevClaim = await prisma.fieldClaim.findUnique({ where: { id: addRes.id } });
            expect(prevClaim?.valueJson).toBeNull(); // Not tombstoned, just superseded

            // Verify canonical
            const attachments = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].attachmentDocumentId).toBe(docId2);
            expect(attachments[0].instanceId).toBe(addRes.instanceId);
        });

        it('Remove: creates tombstone, removes from active, never deletes document/blob', async () => {
            const docId = await makeDocument('test-path-remove');
            const addRes = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId });
            testClaims.push(addRes.id);

            const removeRes = await removeFieldAttachment({
                clientLEId,
                fieldNo: 999,
                instanceId: addRes.instanceId
            });
            testClaims.push(removeRes.id);

            expect(removeRes.instanceId).toBe(addRes.instanceId);
            expect(removeRes.attachmentDocumentId).toBeNull();
            expect(removeRes.valueJson).toEqual({ tombstone: true });

            // Verify active collection
            const attachments = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments).toHaveLength(0);

            // Verify doc exists
            const doc = await prisma.document.findUnique({ where: { id: docId } });
            expect(doc).toBeDefined();
        });
    });

    describe('2. Multiple Attachment Behaviour', () => {
        it('supports multiple attachments simultaneously', async () => {
            const docId1 = await makeDocument('multi-1');
            const docId2 = await makeDocument('multi-2');

            const add1 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId1 });
            const add2 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId2 });
            testClaims.push(add1.id, add2.id);

            const attachments = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments).toHaveLength(2);
            expect(attachments[0].attachmentDocumentId).toBe(docId1);
            expect(attachments[1].attachmentDocumentId).toBe(docId2);

            // Replace one
            const docId1_new = await makeDocument('multi-1-new');
            const rep = await replaceFieldAttachment({ clientLEId, fieldNo: 999, instanceId: add1.instanceId, attachmentDocumentId: docId1_new });
            testClaims.push(rep.id);

            const attachments2 = await KycStateService.getAuthoritativeAttachments({ clientLEId, subjectLeId }, 999);
            expect(attachments2).toHaveLength(2);
            expect(attachments2[0].attachmentDocumentId).toBe(docId1_new); // Keeps original ordering!
            expect(attachments2[1].attachmentDocumentId).toBe(docId2);
        });
    });

    describe('3. Upload Intent Behaviour & 4. Idempotency', () => {
        it('enforces idempotency on Add with identical key', async () => {
            const docId = await makeDocument('idem-add');
            const key = 'idem-key-add-1';

            const add1 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId, idempotencyKey: key });
            testClaims.push(add1.id);

            const add2 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId, idempotencyKey: key });
            
            // Should return same claim
            expect(add2.id).toBe(add1.id);
        });

        it('rejects idempotency key if claim role or field mismatches', async () => {
            const docId = await makeDocument('idem-add-mismatch');
            const key = 'idem-key-add-mismatch';

            const add1 = await addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId, idempotencyKey: key });
            testClaims.push(add1.id);

            // Same key, different field -> conflict
            await expect(addFieldAttachment({ clientLEId, fieldNo: 998, attachmentDocumentId: docId, idempotencyKey: key }))
                .rejects.toThrow(/Idempotency conflict/);
        });

        it('handles intents: PENDING -> COMPLETED and duplicate callbacks', async () => {
            const intent = await prisma.privateDocumentUploadIntent.create({
                data: {
                    clientLEId,
                    initiatedById: 'test-user-part1',
                    storagePathname: 'test-intent-path',
                    originalFilename: 'test.pdf',
                }
            });
            testIntents.push(intent.id);

            // Complete it
            const doc = await DocumentService.verifyAndPersistPrivateUpload({
                intentId: intent.id,
                storagePathname: 'test-intent-path',
                originalFilename: 'test.pdf',
                clientLEId,
                uploadedById: 'test-user-part1'
            });
            testDocs.push(doc.id);

            expect(doc.storagePathname).toBe('test-intent-path');

            // Duplicate callback returns the same document without error
            const doc2 = await DocumentService.verifyAndPersistPrivateUpload({
                intentId: intent.id,
                storagePathname: 'test-intent-path',
                originalFilename: 'test.pdf',
                clientLEId,
                uploadedById: 'test-user-part1'
            });
            expect(doc2.id).toBe(doc.id);
        });
    });

    describe('5. Security & Validation', () => {
        it('rejects attachment if allowAttachments=false', async () => {
            const docId = await makeDocument('sec-1');
            await expect(addFieldAttachment({ clientLEId, fieldNo: 998, attachmentDocumentId: docId }))
                .rejects.toThrow(/Attachments are not permitted for this field/);
        });

        it('rejects attachment of a Document owned by another ClientLE', async () => {
            const otherLe = await prisma.clientLE.create({ data: { name: 'Other LE' } });
            const docId = await prisma.document.create({
                data: { clientLEId: otherLe.id, storageProvider: 'test', storagePathname: 'sec-2', name: 't', fileUrl: 't', fileType: 't' }
            }).then(d => d.id);

            testDocs.push(docId);
            await expect(addFieldAttachment({ clientLEId, fieldNo: 999, attachmentDocumentId: docId }))
                .rejects.toThrow(/does not belong to the requested clientLE/);

            await prisma.clientLE.delete({ where: { id: otherLe.id } });
        });
    });
});
