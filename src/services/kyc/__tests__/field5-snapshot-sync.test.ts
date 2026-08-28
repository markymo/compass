/**
 * field5-snapshot-sync.test.ts
 *
 * Deterministic regression test for ONP-53 / 9.29:
 * Field 5 (Previous Names) snapshot / removal lifecycle.
 *
 * Scenario:
 *  1. Initial snapshot from Companies House: [Previous Name A, Previous Name B]
 *     → Both claims asserted; authoritative collection returns both.
 *  2. Second snapshot from Companies House: [Previous Name A] only (B removed)
 *     → Missing Previous Name B claim is tombstoned under SNAPSHOT_SYNC semantics;
 *     → Authoritative collection returns only Previous Name A.
 *  3. USER_INPUT previous name claims are preserved and not tombstoned by automated sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimStatus } from '@prisma/client';
import { KycWriteService } from '../KycWriteService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { getMasterFieldDefinition, listAllMasterGroupsWithItems } from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import prismaMock from '@/lib/__mocks__/prisma';

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');
vi.mock('@/lib/kyc/KycStateService');
vi.mock('@/lib/kyc/FieldClaimService');

describe('ONP-53 — Field 5 Snapshot / Removal Lifecycle (FilterAndSync)', () => {
    let service: KycWriteService;
    const ENTITY_ID = 'le-field5-test';

    beforeEach(() => {
        vi.clearAllMocks();
        service = new KycWriteService();

        (getMasterFieldDefinition as any).mockResolvedValue({
            fieldNo: 5,
            fieldName: 'Previous Legal Name',
            appDataType: 'JSONB',
            isMultiValue: true,
            modelField: null,
            categoryId: 'NAME_HISTORY',
        });

        (KycStateService.getAuthoritativeValue as any).mockResolvedValue(null);
        (prismaMock.sourceFieldMapping as any).findMany = vi.fn().mockResolvedValue([]);
        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(null);
        (prismaMock.fieldClaim.create as any).mockResolvedValue({ id: 'claim-created' });
        (prismaMock as any).question = { findMany: vi.fn().mockResolvedValue([]) };
        (prismaMock as any).masterFieldGraphBinding = { findMany: vi.fn().mockResolvedValue([]) };
        if (listAllMasterGroupsWithItems) {
            (listAllMasterGroupsWithItems as any).mockResolvedValue([]);
        }
    });

    it('T1: SNAPSHOT_SYNC tombstones omitted Field 5 previous name on second snapshot', async () => {
        const rowKeyA = 'name_alpha_wind_ltd_2010-01-01';
        const rowKeyB = 'name_beta_energy_ltd_2005-01-01';

        const scopedA = `REGISTRATION_AUTHORITY::COMPANIES_HOUSE::${rowKeyA}`;
        const scopedB = `REGISTRATION_AUTHORITY::COMPANIES_HOUSE::${rowKeyB}`;

        // Existing state: Both Alpha and Beta exist in DB from previous run
        const existingClaims = [
            {
                id: 'claim-a',
                instanceId: scopedA,
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                collectionId: 'NAME_HISTORY',
                valueJson: { name: 'ALPHA WIND LTD', effectiveFrom: '2010-01-01', effectiveTo: '2015-01-01' },
                status: ClaimStatus.ASSERTED,
            },
            {
                id: 'claim-b',
                instanceId: scopedB,
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                collectionId: 'NAME_HISTORY',
                valueJson: { name: 'BETA ENERGY LTD', effectiveFrom: '2005-01-01', effectiveTo: '2009-12-31' },
                status: ClaimStatus.ASSERTED,
            },
        ];

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(existingClaims);

        // Second snapshot from Companies House: contains ONLY Alpha Wind Ltd
        const secondSnapshotCandidate = {
            fieldNo: 5,
            value: [
                {
                    name: 'ALPHA WIND LTD',
                    effectiveFrom: '2010-01-01',
                    effectiveTo: '2015-01-01',
                    rowKey: rowKeyA,
                },
            ],
            rowKeys: [rowKeyA],
            source: 'REGISTRATION_AUTHORITY' as any,
            sourceKey: 'COMPANIES_HOUSE',
            syncMode: 'SNAPSHOT_SYNC',
            evidenceId: 'ev-snap-2',
        };

        const result = await service.applyFieldCandidate(
            ENTITY_ID,
            secondSnapshotCandidate,
            'system-user',
            'LEGAL_ENTITY'
        );

        expect(result).toBe(true);

        // Assert: emitTombstone called specifically for omitted Beta Energy Ltd
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledTimes(1);
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            { subjectLeId: ENTITY_ID },
            5,
            'NAME_HISTORY',
            scopedB,
            null,
            'REGISTRATION_AUTHORITY'
        );
    });

    it('T2: SNAPSHOT_SYNC does not tombstone USER_INPUT previous names when source refreshes', async () => {
        const rowKeyA = 'name_alpha_wind_ltd_2010-01-01';
        const scopedA = `REGISTRATION_AUTHORITY::COMPANIES_HOUSE::${rowKeyA}`;
        const userInstanceId = 'user_custom_previous_name_1';

        // Existing claims: 1 from Companies House, 1 manually entered by user
        const existingClaims = [
            {
                id: 'claim-a',
                instanceId: scopedA,
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                collectionId: 'NAME_HISTORY',
                valueJson: { name: 'ALPHA WIND LTD' },
            },
            {
                id: 'claim-user',
                instanceId: userInstanceId,
                sourceType: 'USER_INPUT',
                sourceReference: null,
                collectionId: 'NAME_HISTORY',
                valueJson: { name: 'USER DECLARED HISTORIC TRADING NAME' },
            },
        ];

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(existingClaims);

        // Second snapshot from Companies House: Alpha Wind Ltd
        const snapshotCandidate = {
            fieldNo: 5,
            value: [
                {
                    name: 'ALPHA WIND LTD',
                    effectiveFrom: '2010-01-01',
                    effectiveTo: '2015-01-01',
                    rowKey: rowKeyA,
                },
            ],
            rowKeys: [rowKeyA],
            source: 'REGISTRATION_AUTHORITY' as any,
            sourceKey: 'COMPANIES_HOUSE',
            syncMode: 'SNAPSHOT_SYNC',
            evidenceId: 'ev-snap-3',
        };

        await service.applyFieldCandidate(
            ENTITY_ID,
            snapshotCandidate,
            'system-user',
            'LEGAL_ENTITY'
        );

        // User claim must NOT be tombstoned
        expect(FieldClaimService.emitTombstone).not.toHaveBeenCalled();
    });
});
