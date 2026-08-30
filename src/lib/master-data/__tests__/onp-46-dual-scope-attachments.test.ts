import { describe, it, expect } from 'vitest';
import { resolveFieldCollectionForDisplay, resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';
import { isFieldPermittedByMask, getPartyDisplayProjection } from '@/lib/master-data/party-value';
import { ResolvedAttachment } from '@/lib/master-data/field-display-model';

describe('ONP-46 / ONP-41 / ONP-50 — Party View, Scoped Evidence & Display Mask Contracts', () => {

    it('ONP-46: Scopes Party-level evidence to individual party rows and Field-level evidence to the field container', () => {
        // Setup 2 party items
        const partyAlice = {
            id: 'party-alice-123',
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'Alice',
            surname: 'Smith',
            roles: [{ roleType: 'PSC', roleTitle: 'Significant Controller', isActiveRole: true, natureOfControl: ['ownership-of-shares-25-to-50-percent'] }]
        };

        const partyBob = {
            id: 'party-bob-456',
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'Bob',
            surname: 'Jones',
            roles: [{ roleType: 'PSC', roleTitle: 'Significant Controller', isActiveRole: true, natureOfControl: ['voting-rights-25-to-50-percent'] }]
        };

        // Evidence:
        // 1. Alice party evidence (type: PARTY, partyId: party-alice-123)
        // 2. Bob party evidence (type: PARTY, partyId: party-bob-456)
        // 3. Field-level evidence (type: FIELD_CLAIM, fieldNo: 64)
        const attachments: ResolvedAttachment[] = [
            {
                documentId: 'doc-alice-passport',
                displayName: 'alice-passport.pdf',
                lifecycleCreatedAt: new Date().toISOString(),
                currentDocumentCreatedAt: new Date().toISOString(),
                provenance: [{
                    type: 'PARTY',
                    partyId: 'party-alice-123',
                    partyName: 'Alice Smith',
                    fieldNo: 64,
                    claimId: 'cl-alice',
                    assertedAt: new Date().toISOString(),
                    sourceType: 'USER_INPUT'
                }]
            },
            {
                documentId: 'doc-bob-id',
                displayName: 'bob-id.pdf',
                lifecycleCreatedAt: new Date().toISOString(),
                currentDocumentCreatedAt: new Date().toISOString(),
                provenance: [{
                    type: 'PARTY',
                    partyId: 'party-bob-456',
                    partyName: 'Bob Jones',
                    fieldNo: 64,
                    claimId: 'cl-bob',
                    assertedAt: new Date().toISOString(),
                    sourceType: 'USER_INPUT'
                }]
            },
            {
                documentId: 'doc-control-assessment',
                displayName: 'control-assessment-note.pdf',
                lifecycleCreatedAt: new Date().toISOString(),
                currentDocumentCreatedAt: new Date().toISOString(),
                provenance: [{
                    type: 'FIELD_CLAIM',
                    fieldNo: 64,
                    claimId: 'cl-field-64',
                    assertedAt: new Date().toISOString(),
                    sourceType: 'USER_INPUT'
                }]
            }
        ];

        // Resolve collection for Field 64 (PSCs) with party.documents permitted
        const model = resolveFieldCollectionForDisplay(
            [
                { value: partyAlice, source: { type: 'USER_INPUT' }, instanceId: 'inst-1' },
                { value: partyBob, source: { type: 'USER_INPUT' }, instanceId: 'inst-2' }
            ],
            {
                fieldNo: 64,
                label: 'Persons with significant control',
                appDataType: 'PARTY',
                profileConfig: {
                    displayMask: ['individual.forenames', 'individual.surname', 'role.natureOfControl', 'party.documents']
                },
                attachments
            }
        );

        expect(model.value.kind).toBe('collection');
        if (model.value.kind !== 'collection') return;

        expect(model.value.items.length).toBe(2);

        // Alice item receives ONLY alice-passport.pdf
        const aliceItem = model.value.items[0];
        expect(aliceItem.attachments).toBeDefined();
        expect(aliceItem.attachments?.length).toBe(1);
        expect(aliceItem.attachments?.[0].documentId).toBe('doc-alice-passport');
        expect(aliceItem.attachments?.[0].displayName).toBe('alice-passport.pdf');

        // Bob item receives ONLY bob-id.pdf
        const bobItem = model.value.items[1];
        expect(bobItem.attachments).toBeDefined();
        expect(bobItem.attachments?.length).toBe(1);
        expect(bobItem.attachments?.[0].documentId).toBe('doc-bob-id');
        expect(bobItem.attachments?.[0].displayName).toBe('bob-id.pdf');

        // Field-level container holds all attachments including field-level assessment note
        expect(model.attachments.length).toBe(3);
        const fieldLevelDoc = model.attachments.find(a => a.documentId === 'doc-control-assessment');
        expect(fieldLevelDoc).toBeDefined();
        expect(fieldLevelDoc?.provenance?.[0].type).toBe('FIELD_CLAIM');
    });

    it('ONP-41: Display mask projects permitted PSC attributes and excludes unpermitted attributes', () => {
        const densePsc = {
            contactType: 'PERSON' as const,
            partyType: 'INDIVIDUAL' as const,
            forenames: 'Alexander',
            surname: 'Hamilton',
            dateOfBirth: { year: 1757, month: 1, day: 11 },
            nationality: 'British / American',
            countryOfResidence: 'United Kingdom',
            roles: [{
                roleType: 'PSC',
                roleTitle: 'Person with Significant Control',
                isActiveRole: true,
                appointedOn: '2020-01-15',
                natureOfControl: [
                    'ownership-of-shares-25-to-50-percent',
                    'voting-rights-25-to-50-percent',
                    'right-to-appoint-and-remove-directors'
                ]
            }],
            address: {
                addressLines: ['10 Downing Street'],
                locality: 'London',
                postalCode: 'SW1A 2AA',
                countryName: 'United Kingdom'
            }
        };

        // Mask with forenames, surname, DOB, natureOfControl, address
        const mask = [
            'individual.forenames',
            'individual.surname',
            'individual.dateOfBirth.year',
            'role.natureOfControl',
            'individual.correspondenceAddress'
        ];

        const projection = getPartyDisplayProjection(densePsc as any, mask);

        // Primary text has full name
        expect(projection.primaryText).toBe('Alexander Hamilton');

        // Secondary parts include DOB and humanized nature of control
        expect(projection.secondaryParts).toContain('DOB: 1757');
        expect(projection.secondaryParts.some(p => p.includes('25% to 50%') || p.includes('Appoint and remove directors'))).toBe(true);

        // Address is projected
        expect(projection.addressText).toContain('10 Downing Street');

        // Unpermitted fields: nationality and countryOfResidence are excluded by mask
        expect(isFieldPermittedByMask('individual.nationality', mask)).toBe(false);
        expect(isFieldPermittedByMask('individual.countryOfResidence', mask)).toBe(false);
    });

    it('ONP-50: Canonical display mask determines role lifecycle status visibility without hardcoded field exceptions', () => {
        // Field 104 mask (SSI Callback / Contact): only identity and contact channels
        const f104Mask = [
            'individual.forenames',
            'individual.surname',
            'contact.email',
            'contact.phones'
        ];

        // Director / PSC mask: includes role.isActiveRole
        const directorMask = [
            'individual.forenames',
            'individual.surname',
            'role.roleTitle',
            'role.isActiveRole'
        ];

        // For Field 104, role.isActiveRole and isActivePersonOrContact are excluded by mask
        const f104PermitsStatus = isFieldPermittedByMask('role.isActiveRole', f104Mask) || isFieldPermittedByMask('isActivePersonOrContact', f104Mask);
        expect(f104PermitsStatus).toBe(false);

        // For Director, role.isActiveRole is permitted by mask
        const directorPermitsStatus = isFieldPermittedByMask('role.isActiveRole', directorMask) || isFieldPermittedByMask('isActivePersonOrContact', directorMask);
        expect(directorPermitsStatus).toBe(true);
    });
});
