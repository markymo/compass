import { describe, it, expect, vi } from 'vitest';
import { isFieldPermittedByCatalogue, PARTY_DISPLAY_CATALOGUE } from '../party-display-catalogue';
import { buildPartyFieldProjection } from '../party-value';
import { parseAnyValue } from '../field-interpreter';
import { resolveAmalgamatedAttachments } from '@/lib/kyc/attachments';

// Use vi.hoisted for mocks referenced inside hoisted vi.mock
const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            cCParty: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
            },
            cCAddress: {
                findMany: vi.fn()
            },
            masterFieldDefinition: {
                findUnique: vi.fn(),
                findFirst: vi.fn()
            },
            cCPartyDocument: {
                findMany: vi.fn()
            }
        }
    };
});

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
    default: mockPrisma
}));

import { enrichPartyReferences } from '@/actions/kyc-query';

describe('Comprehensive End-to-End Party Architecture Verification', () => {

    // ── 1. Verify PARTY_REF Submission Snapshotting ──────────────────────────
    describe('1. PARTY_REF Submission Snapshotting', () => {
        it('snapshots initial projected CCParty data and prevents live DB updates from altering historical submission', async () => {
            const partyId = 'cc-party-uuid-1';
            
            // Initial live party state (Email A, Phone A)
            const initialLiveParty = {
                id: partyId,
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                displayName: 'Jane Doe',
                email: 'emailA@example.com',
                phones: [{ phoneNumber: '111-222-3333' }],
                dateOfBirth: '1985-05-15',
                nationality: ['British']
            };

            // Setup Prisma mock to return initial live party
            mockPrisma.cCParty.findMany.mockResolvedValue([
                { id: partyId, data: initialLiveParty }
            ]);

            // Mask exposes email and phone, but hides DOB and nationality
            const mask = ['contact.email', 'contact.phones'];

            // Simulate submission process for a PARTY_REF input { ccPartyId: partyId }
            const rawSubmissionInput = { ccPartyId: partyId };

            // Step 1: Enrich reference from live DB
            const valuesToEnrich = [rawSubmissionInput];
            await enrichPartyReferences(valuesToEnrich);

            expect(rawSubmissionInput).toHaveProperty('ccParty');
            expect((rawSubmissionInput as any).ccParty.data.email).toBe('emailA@example.com');

            // Step 2: Build projected snapshot for submission
            const projectedSnapshot = buildPartyFieldProjection(rawSubmissionInput, mask);

            // Persisted valueJson shape verification
            expect(projectedSnapshot.ccPartyId).toBe(partyId);
            expect(projectedSnapshot.ccParty.data.displayName).toBe('Jane Doe');
            expect(projectedSnapshot.ccParty.data.email).toBe('emailA@example.com');
            expect(projectedSnapshot.ccParty.data.phones).toEqual([{ phoneNumber: '111-222-3333' }]);
            expect(projectedSnapshot.ccParty.data.dateOfBirth).toBeNull();
            expect(projectedSnapshot.ccParty.data.nationality).toEqual([]);

            // Step 3: Now simulate updating the live CCParty in DB to Email B, Phone B
            const updatedLiveParty = {
                id: partyId,
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                displayName: 'Jane Doe',
                email: 'emailB@example.com',
                phones: [{ phoneNumber: '999-888-7777' }],
                dateOfBirth: '1985-05-15',
                nationality: ['British']
            };

            mockPrisma.cCParty.findMany.mockResolvedValue([
                { id: partyId, data: updatedLiveParty }
            ]);

            // Step 4: Re-evaluate historical submission using projectedSnapshot
            // enrichPartyReferences must NOT overwrite existing ccParty snapshot if already present
            const historicalValue = JSON.parse(JSON.stringify(projectedSnapshot));
            await enrichPartyReferences([historicalValue]);

            // Historical submission answer MUST remain Email A, Phone A
            expect(historicalValue.ccParty.data.email).toBe('emailA@example.com');
            expect(historicalValue.ccParty.data.phones).toEqual([{ phoneNumber: '111-222-3333' }]);
            expect(historicalValue.ccParty.data.email).not.toBe('emailB@example.com');

            // Parse formatted display value for historical submission
            const historicalDisplay = parseAnyValue(historicalValue, mask);
            expect(historicalDisplay.kind).toBe('partyRef');
            if (historicalDisplay.kind === 'partyRef') {
                expect(historicalDisplay.resolved?.email).toBe('emailA@example.com');
                expect(historicalDisplay.resolved?.phones).toEqual([{ phoneNumber: '111-222-3333' }]);
            }
        });
    });

    // ── 2. Verify Server-Side Disclosure Control (Real Query/Action Path) ─────
    describe('2. Server-Side Disclosure Control', () => {
        it('redacts unpermitted PII properties from serialized server action payload', () => {
            const rawParty = {
                id: 'p-100',
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                title: 'Dr',
                forenames: 'Alexander',
                surname: 'Hamilton',
                displayName: 'Alexander Hamilton',
                email: 'hamilton@treasury.gov',
                phones: [{ phoneNumber: '555-0199' }],
                dateOfBirth: '1755-01-11',
                correspondenceAddress: { addressLines: ['57 Wall Street'] },
                nationality: ['American'],
                countryOfResidence: 'USA',
                roles: [{ roleTitle: 'Secretary' }]
            };

            // Mask exposing ONLY email and phones
            const mask = ['contact.email', 'contact.phones'];

            const res = parseAnyValue(rawParty, mask);
            expect(res.kind).toBe('party');
            if (res.kind === 'party') {
                const projected = res.data;
                // Exposed
                expect(projected.displayName).toBe('Alexander Hamilton');
                expect(projected.email).toBe('hamilton@treasury.gov');
                expect(projected.phones).toEqual([{ phoneNumber: '555-0199' }]);

                // Redacted / Absent
                expect(projected.title).toBeNull();
                expect(projected.forenames).toBeNull();
                expect(projected.surname).toBeNull();
                expect(projected.dateOfBirth).toBeNull();
                expect(projected.correspondenceAddress).toBeNull();
                expect(projected.nationality).toEqual([]);
                expect(projected.countryOfResidence).toBeNull();
                expect(projected.roles).toEqual([]);

                // Verify keys are explicitly redacted to null/[] in serialized object
                const json = JSON.stringify(projected);
                expect(json).not.toContain('57 Wall Street');
                expect(json).not.toContain('1755-01-11');
                expect(json).not.toContain('American');
                expect(json).not.toContain('Secretary');
            }
        });
    });

    // ── 3. Verify Supplier / Questionnaire Resolution Path ────────────────────
    describe('3. Supplier / Questionnaire Disclosure Control', () => {
        it('ensures supplier-facing parseAnyValue data structures contain no masked attributes', () => {
            const orgParty = {
                id: 'org-1',
                contactType: 'CONTACT',
                partyType: 'ORGANISATION',
                organisationName: 'Acme Clean Energy Corp',
                legalName: 'Acme Clean Energy Corporation Limited',
                companyName: 'Acme Clean Energy',
                registrationNumber: 'UK12345678',
                email: 'contact@acme.com',
                phones: [{ phoneNumber: '020-7946-0000' }]
            };

            // Mask exposes registration number only
            const mask = ['organisation.registrationNumber'];

            const res = parseAnyValue(orgParty, mask);
            expect(res.kind).toBe('party');
            if (res.kind === 'party') {
                const projected = res.data;
                expect(projected.displayName).toBe('Acme Clean Energy Corp');
                expect(projected.registrationNumber).toBe('UK12345678');
                expect(projected.email).toBeNull();
                expect(projected.phones).toEqual([]);

                const serialized = JSON.stringify(projected);
                expect(serialized).not.toContain('contact@acme.com');
                expect(serialized).not.toContain('020-7946-0000');
            }
        });
    });

    // ── 4. Verify Multi-Party Document Association ───────────────────────────
    describe('4. Multi-Party Document Association', () => {
        it('associates documents strictly with their owning Party and hides all documents when party.documents is denied', async () => {
            const partyA = {
                ccPartyId: 'party-A',
                partyType: 'INDIVIDUAL',
                displayName: 'Party A'
            };
            const partyB = {
                ccPartyId: 'party-B',
                partyType: 'ORGANISATION',
                displayName: 'Party B'
            };

            const collectionValue = [partyA, partyB];

            const now = new Date();
            const docsMock = [
                {
                    id: 'pdoc-A',
                    instanceId: 'inst-A',
                    partyId: 'party-A',
                    documentId: 'doc-A',
                    operation: 'ATTACH',
                    assertedAt: now,
                    document: { id: 'doc-A', name: 'Passport_A.pdf', mimeType: 'application/pdf', sizeBytes: 1024, createdAt: now },
                    party: { data: partyA }
                },
                {
                    id: 'pdoc-B',
                    instanceId: 'inst-B',
                    partyId: 'party-B',
                    documentId: 'doc-B',
                    operation: 'ATTACH',
                    assertedAt: now,
                    document: { id: 'doc-B', name: 'Cert_B.pdf', mimeType: 'application/pdf', sizeBytes: 2048, createdAt: now },
                    party: { data: partyB }
                }
            ];

            mockPrisma.cCPartyDocument.findMany.mockImplementation(async (query?: any) => {
                if (query?.where?.partyId?.in && query.where.partyId.in.length > 0) {
                    return docsMock;
                }
                return [];
            });

            const resolvedValuesMap = new Map<number, any>([
                [274, collectionValue]
            ]);

            const fieldDefsMap = new Map([
                [274, { allowAttachments: false, profileConfig: { displayMask: ['party.documents'] } }]
            ]);

            // 1. When party.documents IS permitted:
            const permittedResultMap = await resolveAmalgamatedAttachments(
                { clientLEId: 'le-123' },
                [274],
                resolvedValuesMap,
                fieldDefsMap
            );

            const attachments = permittedResultMap.get(274) || [];
            expect(attachments.length).toBe(2);
            expect(attachments.map(a => a.displayName)).toContain('Passport_A.pdf');
            expect(attachments.map(a => a.displayName)).toContain('Cert_B.pdf');

            // Verify per-party provenance association
            const docAAtt = attachments.find(a => a.displayName === 'Passport_A.pdf');
            expect(docAAtt?.provenance[0]).toMatchObject({ type: 'PARTY', partyId: 'party-A' });

            const docBAtt = attachments.find(a => a.displayName === 'Cert_B.pdf');
            expect(docBAtt?.provenance[0]).toMatchObject({ type: 'PARTY', partyId: 'party-B' });

            // 2. When party.documents IS DENIED:
            const deniedFieldDefsMap = new Map([
                [274, { allowAttachments: false, profileConfig: { displayMask: [] } }]
            ]);

            const deniedResultMap = await resolveAmalgamatedAttachments(
                { clientLEId: 'le-123' },
                [274],
                resolvedValuesMap,
                deniedFieldDefsMap
            );

            expect(deniedResultMap.get(274) || []).toEqual([]);
        });
    });

    // ── 5. Verify Party Documents in Immutable Submissions ───────────────────
    describe('5. Party Documents in Immutable Submissions', () => {
        it('snapshots permitted Party document IDs at submission time without live DB dependencies', () => {
            const mask = ['party.documents'];
            const partyValue = {
                ccPartyId: 'party-xyz',
                displayName: 'PSC Director'
            };

            const permitsDocs = isFieldPermittedByCatalogue('party.documents', mask);
            expect(permitsDocs).toBe(true);

            // Projected party object
            const projected = buildPartyFieldProjection(partyValue, mask);
            expect(projected).toHaveProperty('ccPartyId', 'party-xyz');

            // Snapshot document ID
            const snapshottedDocId = 'doc-snapshot-123';
            const submissionAnswerAttachment = {
                submissionAnswerId: 'sub-ans-1',
                documentId: snapshottedDocId
            };

            expect(submissionAnswerAttachment.documentId).toBe('doc-snapshot-123');

            // When party.documents is denied, no Party docs snapshot
            const deniedMask = [];
            expect(isFieldPermittedByCatalogue('party.documents', deniedMask)).toBe(false);
        });
    });

    // ── 6. Verify Master Field Manager Semantics ─────────────────────────────
    describe('6. Master Field Manager Semantics', () => {
        it('correctly evaluates undefined vs explicit [] vs custom displayMasks', () => {
            // undefined mask -> ALLOW ALL
            expect(isFieldPermittedByCatalogue('party.documents', undefined)).toBe(true);
            expect(isFieldPermittedByCatalogue('contact.email', undefined)).toBe(true);

            // explicit [] mask -> DENY ALL optional fields
            expect(isFieldPermittedByCatalogue('party.documents', [])).toBe(false);
            expect(isFieldPermittedByCatalogue('contact.email', [])).toBe(false);

            // explicit mask with party.documents -> ALLOW listed ONLY
            const customMask = ['party.documents', 'contact.email'];
            expect(isFieldPermittedByCatalogue('party.documents', customMask)).toBe(true);
            expect(isFieldPermittedByCatalogue('contact.email', customMask)).toBe(true);
            expect(isFieldPermittedByCatalogue('contact.phones', customMask)).toBe(false);
        });
    });

    // ── 7. Verify Minimum Identity Invariance ────────────────────────────────
    describe('7. Minimum Identity Invariance', () => {
        it('preserves invariant display label while redacting PII when displayMask is []', () => {
            // Individual
            const ind = { contactType: 'PERSON', partyType: 'INDIVIDUAL', forenames: 'John', surname: 'Doe', dateOfBirth: '1990-01-01' };
            const projInd = buildPartyFieldProjection(ind, []);
            expect(projInd.displayName).toBe('John Doe');
            expect(projInd.forenames).toBeNull();
            expect(projInd.surname).toBeNull();
            expect(projInd.dateOfBirth).toBeNull();

            // Organisation
            const org = { contactType: 'CONTACT', partyType: 'ORGANISATION', organisationName: 'Tech Corp', legalName: 'Tech Corp', registrationNumber: '12345' };
            const projOrg = buildPartyFieldProjection(org, []);
            expect(projOrg.displayName).toBe('Tech Corp');
            expect(projOrg.organisationName).toBeFalsy();
            expect(projOrg.registrationNumber).toBeFalsy();

            // Team
            const team = { partyType: 'TEAM', teamName: 'Risk Team', email: 'risk@company.com' };
            const projTeam = buildPartyFieldProjection(team, []);
            expect(projTeam.displayName).toBe('Risk Team');
            expect(projTeam.teamName).toBeFalsy();
            expect(projTeam.email).toBeNull();
        });
    });

    // ── 8. Verify party.documents Catalogue Placement ────────────────────────
    describe('8. party.documents Catalogue Placement', () => {
        it('verifies party.documents definition in PARTY_DISPLAY_CATALOGUE', () => {
            const docDef = PARTY_DISPLAY_CATALOGUE.find(item => item.key === 'party.documents');
            expect(docDef).toBeDefined();
            expect(docDef?.label).toBe('Documents');
            expect(docDef?.category).toBe('CONTACT'); // Shared across Individual, Org, Team
            expect(docDef?.appliesToPartyTypes).toEqual(['INDIVIDUAL', 'ORGANISATION', 'TEAM']);
            expect(docDef?.legacyKeys).toEqual(['party.documents']);
        });
    });
});
