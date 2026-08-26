import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PermissionsReferencePage from '@/app/(platform)/app/admin/permissions/page';
import { ACTION_DOCUMENTATION, ACTION_MATRIX_ROWS } from '@/app/(platform)/app/admin/permissions/action-descriptions';
import { Action } from '@/lib/auth/permissions';
import { getIdentity } from '@/lib/auth';
import { checkIsSystemAdmin } from '@/actions/client';
import { redirect } from 'next/navigation';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/actions/client', () => ({
    checkIsSystemAdmin: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

describe('Permissions Reference Page (/app/admin/permissions)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Security & Admission Gates', () => {
        it('redirects unauthenticated users to /login', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            await expect(PermissionsReferencePage()).rejects.toThrow('REDIRECT:/login');
            expect(redirect).toHaveBeenCalledWith('/login');
        });

        it('redirects non-System Admin users to /app', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-client-1', email: 'client@example.com' } as any);
            vi.mocked(checkIsSystemAdmin).mockResolvedValue(false);

            await expect(PermissionsReferencePage()).rejects.toThrow('REDIRECT:/app');
            expect(redirect).toHaveBeenCalledWith('/app');
        });

        it('allows legitimate SYSTEM_ADMIN users to access the page', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-sysadmin-1', email: 'admin@coparity.com' } as any);
            vi.mocked(checkIsSystemAdmin).mockResolvedValue(true);

            const jsx = await PermissionsReferencePage();
            expect(jsx).toBeDefined();

            const html = renderToString(jsx as React.ReactElement);
            expect(html).toContain('Permissions Model');
            expect(html).toContain('Internal • System Admin only');
        });
    });

    describe('2. Required Content Invariants', () => {
        let html: string;

        beforeEach(async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-sysadmin-1', email: 'admin@coparity.com' } as any);
            vi.mocked(checkIsSystemAdmin).mockResolvedValue(true);

            const jsx = await PermissionsReferencePage();
            html = renderToString(jsx as React.ReactElement);
        });

        it('contains both "Current implementation" and "January 2026 specification" sections', () => {
            expect(html).toContain('Current implementation');
            expect(html).toContain('Source of truth: active authorization code');
            expect(html).toContain('January 2026 specification');
            expect(html).toContain('docs/CompassUserPermissions.ods');
        });

        it('displays the core top-level architectural principle prominently', () => {
            expect(html).toContain('Administrative roles administer accounts and platform structure. Operational roles grant access to customer data.');
        });

        it('lists all 7 active current roles and excludes SUPPLIER_ADMIN from current roles', () => {
            // Active current roles
            expect(html).toContain('SYSTEM_ADMIN');
            expect(html).toContain('ORG_ADMIN');
            expect(html).toContain('ORG_MEMBER');
            expect(html).toContain('LE_ADMIN');
            expect(html).toContain('LE_USER');
            expect(html).toContain('RELATIONSHIP_ADMIN');
            expect(html).toContain('RELATIONSHIP_USER');

            // SUPPLIER_ADMIN must NOT appear as a current role
            const currentImplementationIdx = html.indexOf('Current implementation');
            const januarySpecIdx = html.indexOf('January 2026 specification');
            const currentSectionHtml = html.slice(currentImplementationIdx, januarySpecIdx);

            expect(currentSectionHtml).not.toContain('SUPPLIER_ADMIN');
        });

        it('faithfully preserves the January 2026 historical personas and sign-off distinction', () => {
            const januarySpecIdx = html.indexOf('January 2026 specification');
            const januarySectionHtml = html.slice(januarySpecIdx);

            expect(januarySectionHtml).toContain('Client Admin');
            expect(januarySectionHtml).toContain('FI Admin');
            expect(januarySectionHtml).toContain('FI Relationship Admin');
            expect(januarySectionHtml).toContain('FI Relationship User');
            expect(januarySectionHtml).toContain('Questionnaire Response Sign-Off');
            expect(januarySectionHtml).toContain('Process Completion Sign-Off');
        });

        it('explains the model evolution from Client Admin / FI Admin to ORG_ADMIN', () => {
            const evolutionIdx = html.indexOf('How the model evolved');
            const evolutionSectionHtml = html.slice(evolutionIdx);

            expect(evolutionSectionHtml).toContain('Client Admin');
            expect(evolutionSectionHtml).toContain('FI Admin');
            expect(evolutionSectionHtml).toContain('ORG_ADMIN');
            expect(evolutionSectionHtml).toContain('SYSTEM_ADMIN');
            expect(evolutionSectionHtml).toContain('ORG_MEMBER');
        });

        it('explicitly states that System Admin has no automatic customer operational-data access', () => {
            expect(html).toContain('No customer operational data');
            expect(html).toContain('Cannot view/edit ClientLE data, live relationships, or private customer documents');
            expect(html).toContain('Platform administration does not imply customer operational access');
        });
    });

    describe('3. Action Descriptions & Technical Action Matrix Invariants', () => {
        let html: string;

        beforeEach(async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-sysadmin-1', email: 'admin@coparity.com' } as any);
            vi.mocked(checkIsSystemAdmin).mockResolvedValue(true);

            const jsx = await PermissionsReferencePage();
            html = renderToString(jsx as React.ReactElement);
        });

        it('completeness: every current Action enum has a non-empty documentation entry and matrix row', () => {
            const allActions = Object.values(Action);
            expect(allActions.length).toBeGreaterThan(0);

            for (const action of allActions) {
                const doc = ACTION_DOCUMENTATION[action];
                expect(doc, `Missing documentation entry for ${action}`).toBeDefined();
                expect(doc.name.trim().length, `Empty name for ${action}`).toBeGreaterThan(0);
                expect(doc.summary.trim().length, `Empty summary for ${action}`).toBeGreaterThan(0);
                expect(doc.description.trim().length, `Empty description for ${action}`).toBeGreaterThan(20);
                expect(doc.scope.trim().length, `Empty scope for ${action}`).toBeGreaterThan(0);

                const matrixRow = ACTION_MATRIX_ROWS.find(r => r.action === action);
                expect(matrixRow, `Missing matrix row for ${action}`).toBeDefined();
            }
        });

        it('renders expandable <details> / <summary> elements for every action in the matrix', () => {
            const allActions = Object.values(Action);
            for (const action of allActions) {
                expect(html).toContain(action);
            }
            expect(html).toContain('<details class="group"');
            expect(html).toContain('<summary class="list-none cursor-pointer');
        });

        it('renders representative plain-English descriptions for key actions', () => {
            // SYSTEM_MANAGE_TENANTS
            expect(html).toContain('Create and administer OnPro tenant organisations, users, memberships, and invitations across the ecosystem.');

            // LE_VIEW_MASTER_DATA
            expect(html).toContain("View the ClientLE&#x27;s operational Master Data, canonical KYC dossier values, ownership structure, and attached private verification documents.");

            // ENG_EDIT_DRAFT_RESPONSES
            expect(html).toContain('Create and update draft questionnaire responses, field answers, and relationship-specific query resolutions for the relationship in scope.');

            // QUESTIONNAIRE_UPDATE
            expect(html).toContain('Edit, update sections and questions, and configure tenant-owned reusable questionnaire templates in the organisation library');
        });

        it('SYSTEM_MANAGE_TENANTS description explicitly states it does not grant customer operational access', () => {
            const sysTenantDoc = ACTION_DOCUMENTATION[Action.SYSTEM_MANAGE_TENANTS];
            expect(sysTenantDoc.restrictions).toContain('does not grant ClientLE or relationship customer operational access');
            expect(html).toContain('does not grant ClientLE or relationship customer operational access');
        });
    });
});
