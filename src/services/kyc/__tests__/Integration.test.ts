import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/prisma';
import { KycWriteService } from '../KycWriteService';
import { DocumentService } from '../DocumentService';
import { ModuleValidator } from '../ModuleValidator';
import { v4 as uuidv4 } from 'uuid';

describe('KYC Service Layer Integration', () => {
    const kycService = new KycWriteService();
    const docService = new DocumentService();
    const validator = new ModuleValidator();

    let legalEntityId: string;
    const testRef = `TEST-INTEGRATION-${uuidv4()}`;

    beforeAll(async () => {
        // 1. Create a test Legal Entity
        const le = await prisma.legalEntity.create({
            data: {
                reference: testRef,
            },
        });
        legalEntityId = le.id;
        console.log(`Created test LegalEntity: ${legalEntityId}`);
    });

    afterAll(async () => {
        // Cleanup
        if (legalEntityId) {
            // Delete document registry entries first? Cascade should handle it if relation exists.
            // Relationships: DocumentRegistry -> LegalEntity (Cascade)
            await prisma.legalEntity.delete({
                where: { id: legalEntityId },
            });
            console.log(`Deleted test LegalEntity: ${legalEntityId}`);
        }
    });

    describe('IdentityProfile (1:1 Model)', () => {
        it('should write Legal Name (Field 3) with provenance', async () => {
            const fieldNo = 3;
            const value = 'Integration Test Corp';
            const provenance = {
                source: 'USER_INPUT' as const,
                verifiedBy: uuidv4(),
                timestamp: new Date().toISOString(),
            };

            await kycService.updateField(legalEntityId, fieldNo, value, provenance);

            // Verify DB
            const profile = await prisma.identityProfile.findUnique({
                where: { legalEntityId },
            });

            expect(profile).toBeDefined();
            expect(profile?.legalName).toBe(value);

            // Verify Meta
            const meta = profile?.meta as any;
            expect(meta).toBeDefined();
            expect(meta.legalName).toBeDefined();
            expect(meta.legalName.field_no).toBe(3);
            expect(meta.legalName.source).toBe('USER_INPUT');
        });

        it('should validate IdentityProfile completeness (initially incomplete)', async () => {
            // Missing LEI
            const result = await validator.validateModule(legalEntityId, 'IdentityProfile');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Missing LEI'))).toBe(true);
        });

        it('should write LEI (Field 2) and become valid', async () => {
            await kycService.updateField(legalEntityId, 2, '54930012345678901234', {
                source: 'GLEIF',
                evidenceId: uuidv4()
            });

            const result = await validator.validateModule(legalEntityId, 'IdentityProfile');
            if (!result.valid) {
                console.log('IdentityProfile Validation Errors:', result.errors);
            }
            expect(result.valid).toBe(true);
        });
    });

    describe('AuthorizedTrader (1:N Model)', () => {
        let traderRowId: string;

        it('should validation fail if no traders exist', async () => {
            const result = await validator.validateModule(legalEntityId, 'AuthorizedTrader');
            expect(result.valid).toBe(false);
            // "Module AuthorizedTrader has no data" is expected for empty 1:N
            expect(result.errors[0]).toContain('has no data');
        });

        it('should create a new Trader row', async () => {
            traderRowId = await kycService.createRepeatingRow(
                legalEntityId,
                'AuthorizedTrader',
                {
                    fullName: 'John Trader',
                    email: 'john@example.com' // Required field
                },
                {
                    fullName: {
                        field_no: 96,
                        source: 'USER_INPUT',
                        timestamp: new Date().toISOString()
                    },
                    email: {
                        field_no: 97,
                        source: 'USER_INPUT',
                        timestamp: new Date().toISOString()
                    }
                }
            );
            expect(traderRowId).toBeDefined();
        });

        it('should fail validation due to missing Field 100', async () => {
            const result = await validator.validateModule(legalEntityId, 'AuthorizedTrader');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Proof of Authority'))).toBe(true);
        });

        it('should upload a document and link it to Field 100', async () => {
            const userUuid = uuidv4();

            // 1. Upload Doc
            const docId = await docService.uploadDocument({
                legalEntityId,
                ownerType: 'AUTHORIZED_TRADER',
                ownerId: traderRowId,
                fieldNo: 100,
                fileName: 'authority.pdf',
                filePath: 'dummy',
                mimeType: 'application/pdf',
                uploadedBy: userUuid
            });

            expect(docId).toBeDefined();

            // 2. Update Field 100 (authorityDocumentId)
            await kycService.updateField(
                legalEntityId,
                100,
                docId,
                { source: 'USER_INPUT', verifiedBy: userUuid },
                traderRowId
            );

            // 3. Validate
            const result = await validator.validateModule(legalEntityId, 'AuthorizedTrader');
            if (!result.valid) {
                console.log('AuthorizedTrader Validation Errors:', result.errors);
            }
            expect(result.valid).toBe(true);
        });
    });
});
