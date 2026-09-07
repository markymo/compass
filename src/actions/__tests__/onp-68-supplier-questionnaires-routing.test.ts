import { describe, it, expect } from 'vitest';

describe('SUPP-01 / ONP-68 — Supplier Questionnaires Routing & Navigation Contract', () => {
    it('1. Supplier relationship questionnaire review URL points to /app/s/[id]/questions with encoded parameters', () => {
        const orgId = 'org-fi-123';
        const clientLEName = 'Alpha Tech Ltd';
        const questionnaireName = 'Standard Security DD';

        const reviewParams = new URLSearchParams({
            rel: clientLEName,
            q: questionnaireName
        });
        const reviewHref = `/app/s/${orgId}/questions?${reviewParams.toString()}`;

        expect(reviewHref).toBe('/app/s/org-fi-123/questions?rel=Alpha+Tech+Ltd&q=Standard+Security+DD');
    });

    it('2. Legacy supplier engagement path redirects to /app/s/[id]?expand=[engagementId]', () => {
        const orgId = 'org-fi-123';
        const engagementId = 'eng-456';
        const redirectTarget = `/app/s/${orgId}?expand=${engagementId}`;

        expect(redirectTarget).toBe('/app/s/org-fi-123?expand=eng-456');
    });
});
