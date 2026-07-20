const fs = require('fs');
const path = '/opt/code/coparity/src/lib/export/__tests__/export-answer-resolver.test.ts';
let content = fs.readFileSync(path, 'utf8');

const testsToAdd = `
    describe('Identity guard relaxations (Localized Master Data)', () => {
        const fixedDate = new Date("2025-01-01T00:00:00Z");

        it('1. unresolved ClientLE (undefined subjectLeId) successfully exports mapped ADDRESS field', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 138 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'ADDRESS',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            // Mock an ASSERTED authoritative claim for a localized entity
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: {
                    locality: 'London',
                    postalCode: 'EC2',
                    addressLines: ['123 Canonical Way']
                },
                sourceType: 'USER_INPUT',
                status: 'ASSERTED',
                assertedAt: fixedDate,
                claimId: 'claim-loc'
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-loc',
                verifiedBy: { name: 'Alice Local' }
            } as any);

            // Pass undefined for subjectLeId
            const res = await resolveExportAnswer(question, undefined, "scope-local", "entity-loc");
            
            expect(res.displayValue).toBe("123 Canonical Way, London, EC2");
            expect(res.answerState).toBe("HAS_VALUE");
            expect(res.sourceLabel).toBe("User input — Alice Local");
            expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
                { subjectLeId: undefined, clientLEId: "entity-loc" },
                138,
                "scope-local",
                undefined
            );
        });

        it('2. resolved Legal Entity successfully exports VERIFIED mapped ADDRESS field', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 138 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'ADDRESS',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            // Mock a VERIFIED authoritative claim for a resolved entity
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: {
                    locality: 'Verona',
                    postalCode: '37121',
                    addressLines: ['Via Verona 1']
                },
                sourceType: 'COMPANIES_HOUSE',
                status: 'VERIFIED',
                assertedAt: fixedDate,
                claimId: 'claim-glb'
            } as any);

            // Pass resolved subjectLeId
            const res = await resolveExportAnswer(question, "glb-subject", "scope-glb", "entity-glb");
            
            expect(res.displayValue).toBe("Via Verona 1, Verona, 37121");
            expect(res.answerState).toBe("HAS_VALUE");
            expect(res.sourceLabel).toBe("Companies House");
            expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
                { subjectLeId: "glb-subject", clientLEId: "entity-glb" },
                138,
                "scope-glb",
                undefined
            );
        });

        it('3. unresolved ClientLE exports mapped TEXT field without regression', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 21 }; // e.g. Legal Form
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'TEXT',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: 'Limited Liability Company',
                sourceType: 'SYSTEM_DERIVED',
                status: 'VERIFIED',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, undefined, "scope-txt", "entity-txt");
            
            expect(res.displayValue).toBe("Limited Liability Company");
            expect(res.answerState).toBe("HAS_VALUE");
        });
        
        it('4. grouped master fields fetch successfully without subjectLeId', async () => {
            const question = { status: 'DRAFT', masterQuestionGroupId: 'grp-1' };
            
            vi.mocked(getMasterFieldGroup).mockResolvedValue({
                items: [{ fieldNo: 138, order: 1 }]
            } as any);
            
            vi.mocked(getMasterFieldDefinition).mockResolvedValue({
                fieldNo: 138, fieldName: 'Legal Address', appDataType: 'ADDRESS'
            } as any);
            
            vi.mocked(resolveMasterDataBatch).mockResolvedValue({
                [question.id]: {
                    138: {
                        value: { locality: 'Paris' },
                        source: 'GLEIF',
                        isSynced: true
                    }
                }
            } as any);
            
            const res = await resolveExportAnswer(question, undefined, "scope-grp", "entity-grp");
            expect(res.groupFields?.length).toBe(1);
            expect(res.groupFields?.[0].displayValue).toBe("Paris");
        });
        
        it('5. resolves attachments correctly using entityId', async () => {
             const question = { status: 'DRAFT', masterFieldNo: 100 };
             vi.mocked(getFieldDetail).mockResolvedValue({
                 dataType: 'TEXT', isRepeating: false, displayState: 'HAS_VALUE'
             } as any);
             vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                 value: 'test', sourceType: 'USER_INPUT', status: 'ASSERTED', assertedAt: fixedDate
             } as any);
             
             const attachmentsMap = new Map();
             attachmentsMap.set(100, [{ documentName: 'test.pdf', attachmentDocumentId: 'doc-1' }]);
             vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(attachmentsMap);
             
             const res = await resolveExportAnswer(question, undefined, "scope-att", "entity-att");
             
             expect(res.attachmentFilenames).toEqual(['test.pdf']);
             expect(KycStateService.resolveAllAttachments).toHaveBeenCalledWith(
                 { subjectLeId: undefined, clientLEId: 'entity-att' },
                 [100]
             );
        });
    });
});
`;

content = content.replace(/}\);\n}\);\s*$/, testsToAdd);
fs.writeFileSync(path, content);
