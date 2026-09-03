import { describe, it, expect, vi } from 'vitest';
import { getFieldUsageDetails } from '../client-le';

const { MOCK_CLIENT_LE_ID } = vi.hoisted(() => ({
    MOCK_CLIENT_LE_ID: 'cle-onp180-test'
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'usr-onp180-test', role: 'LE_ADMIN' })
}));

vi.mock('@/actions/security', () => ({
    ensureApiAuthorization: vi.fn().mockResolvedValue(true),
    getUserFIOrg: vi.fn().mockResolvedValue(null),
    isSystemAdmin: vi.fn().mockResolvedValue(false)
}));

// Setup mock dataset mirroring production Workbench4 reproduction
const mockOrganizations = [
    { id: 'org-barclays', name: 'Barclays', shortCode: 'BRCLY' },
    { id: 'org-riskbridge', name: 'Riskbridge Associates', shortCode: 'RSKBDG' }
];

const mockEngagements = [
    { id: 'eng-barclays', clientLEId: MOCK_CLIENT_LE_ID, fiOrgId: 'org-barclays', status: 'PREPARATION', isDeleted: false },
    { id: 'eng-riskbridge', clientLEId: MOCK_CLIENT_LE_ID, fiOrgId: 'org-riskbridge', status: 'PREPARATION', isDeleted: false }
];

const mockQuestionnaires = [
    // Relationship A (Barclays) - Questionnaire with isTemplate: true (Process Template attached to active engagement)
    { id: 'qn-barclays-template', name: 'FSMB MASTER DRAFT (Barclays)', fiEngagementId: 'eng-barclays', isTemplate: true, isDeleted: false },
    // Relationship B (Riskbridge) - Questionnaire with isTemplate: true (Process Template attached to active engagement)
    { id: 'qn-riskbridge-template', name: 'FSMB MASTER DRAFT (Riskbridge)', fiEngagementId: 'eng-riskbridge', isTemplate: true, isDeleted: false }
];

const mockQuestions = [
    { id: 'q-barclays-74', questionnaireId: 'qn-barclays-template', masterFieldNo: 74, text: 'ORGANISATION CHART' },
    { id: 'q-riskbridge-74', questionnaireId: 'qn-riskbridge-template', masterFieldNo: 74, text: 'ORGANISATION CHART' }
];

vi.mock('@/lib/prisma', () => {
    return {
        default: {
            membership: {
                findMany: vi.fn().mockResolvedValue([{ role: 'LE_ADMIN', clientLEId: 'cle-onp180-test' }])
            },
            $queryRaw: vi.fn().mockImplementation(async (queryParam: any) => {
                // Convert Prisma SQL template query to plain text string
                const queryString = Array.isArray(queryParam?.strings)
                    ? queryParam.strings.join(' ')
                    : String(queryParam);

                const hasIsTemplateFalseFilter = queryString.includes('qn."isTemplate" = false');

                const results: Array<{
                    question_id: string;
                    question_text: string;
                    qn_id: string;
                    qn_name: string;
                    supplier_id: string;
                    supplier_name: string | null;
                    supplier_code: string | null;
                }> = [];

                for (const q of mockQuestions) {
                    if (q.masterFieldNo !== 74) continue;
                    const qn = mockQuestionnaires.find(item => item.id === q.questionnaireId);
                    if (!qn || qn.isDeleted) continue;

                    // If query strictly enforces qn."isTemplate" = false, exclude templates
                    if (hasIsTemplateFalseFilter && qn.isTemplate) continue;

                    const eng = mockEngagements.find(e => e.id === qn.fiEngagementId);
                    if (!eng || eng.isDeleted || eng.status === 'ARCHIVED' || eng.clientLEId !== MOCK_CLIENT_LE_ID) continue;

                    const org = mockOrganizations.find(o => o.id === eng.fiOrgId);

                    results.push({
                        question_id: q.id,
                        question_text: q.text,
                        qn_id: qn.id,
                        qn_name: qn.name,
                        supplier_id: eng.fiOrgId,
                        supplier_name: org?.name || null,
                        supplier_code: org?.shortCode || null
                    });
                }

                return results;
            })
        }
    };
});

describe('ONP-180 Real Data-Layer Usage Discovery Logic', () => {
    it('1. Workbench mapped questions attached to active engagements (templates & instances) are included in getFieldUsageDetails', async () => {
        const usage = await getFieldUsageDetails(MOCK_CLIENT_LE_ID, 74);

        expect(usage.totalQuestions).toBe(2);
        expect(usage.totalQuestionnaires).toBe(2);
        expect(usage.totalSuppliers).toBe(2);

        expect(usage.questions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'q-barclays-74', text: 'ORGANISATION CHART', supplierName: 'Barclays' }),
                expect.objectContaining({ id: 'q-riskbridge-74', text: 'ORGANISATION CHART', supplierName: 'Riskbridge Associates' })
            ])
        );

        expect(usage.relationships).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ supplierId: 'org-barclays', supplierName: 'Barclays' }),
                expect.objectContaining({ supplierId: 'org-riskbridge', supplierName: 'Riskbridge Associates' })
            ])
        );
    });
});
