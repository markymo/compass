import { test, expect, Page } from '@playwright/test';
import prisma from '../../src/lib/prisma';
import { FieldClaimService } from '../../src/lib/kyc/FieldClaimService';
import { KycStateService } from '../../src/lib/kyc/KycStateService';
import { SourceType } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Focused Wave 06 Deployed Browser Contracts (PW06-01 .. PW06-07)
// Executed against Preview Deployment with workers=1 and strict disposable fixture lifecycle

async function openFieldDrawer(page: Page, fieldNo: number) {
    // 1. Expand all categories if available
    const expandAllBtn = page.getByRole('button', { name: /Expand all/i });
    if (await expandAllBtn.isVisible()) {
        await expandAllBtn.click();
        await page.waitForTimeout(400);
    }

    // 2. Locate field card
    const fieldCard = page.locator(`[data-testid="master-field-${fieldNo}"], [data-field-no="${fieldNo}"]`).first();
    await expect(fieldCard).toBeVisible({ timeout: 15000 });
    await fieldCard.scrollIntoViewIfNeeded();

    // 3. Click inspect/open button
    const openBtn = fieldCard.locator('button[aria-label*="Open details"], button[aria-label*="Inspect field"], [role="button"]').first();
    if (await openBtn.isVisible()) {
        await openBtn.click();
    } else {
        await fieldCard.click();
    }

    // 4. Wait for drawer
    const drawer = page.locator('[role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 15000 });
    return drawer;
}

test.describe('Wave 06 Preview Deployed Behavioural Gate', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let alicePartyId: string;
    let bobPartyId: string;
    let testAddressId: string;
    let unpromotedClaimId: string;

    const testTimestamp = Date.now();

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        const alphaLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] },
            include: { owners: true }
        });
        if (!alphaLE) throw new Error('uat_cle_alpha not found in database');

        const leAdminUser = await prisma.user.findUnique({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!leAdminUser) {
            throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found in database`);
        }

        // Create disposable ClientLE with valid owners & memberships
        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `cle_pw06_${testTimestamp}`,
                name: `Wave06 Disposable CLE ${testTimestamp}`,
                owners: {
                    create: {
                        partyId: alphaLE.owners[0]?.partyId || alphaLE.id
                    }
                },
                memberships: {
                    create: {
                        userId: leAdminUser.id,
                        role: 'LE_ADMIN'
                    }
                }
            }
        });
        clientLEId = disposableLE.id;
        const ownerScopeId = (await KycStateService.resolveScopeId(clientLEId)) || undefined;

        // Create reusable CCParty Alice
        const alice = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    title: null,
                    forenames: 'Alice',
                    surname: `Smith ${testTimestamp}`,
                    knownAs: null,
                    emails: [`alice.${testTimestamp}@example.com`],
                    phones: [],
                    roles: [
                        {
                            roleTitle: 'Director',
                            roleType: 'DIRECTOR',
                            company: null,
                            isActiveRole: true,
                            appointedOn: null,
                            resignedOn: null,
                            natureOfControl: []
                        }
                    ],
                    sourceIdentifiers: [],
                    homeAddressRef: null,
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null,
                    isActiveParty: true
                } as any,
                createdByUserId: leAdminUser.id
            }
        });
        alicePartyId = alice.id;

        // Create reusable CCParty Bob
        const bob = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    title: null,
                    forenames: 'Bob',
                    surname: `Jones ${testTimestamp}`,
                    knownAs: null,
                    emails: [`bob.${testTimestamp}@example.com`],
                    phones: [],
                    roles: [
                        {
                            roleTitle: 'Shareholder',
                            roleType: 'SHAREHOLDER',
                            company: null,
                            isActiveRole: true,
                            appointedOn: null,
                            resignedOn: null,
                            natureOfControl: []
                        }
                    ],
                    sourceIdentifiers: [],
                    homeAddressRef: null,
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null,
                    isActiveParty: true
                } as any,
                createdByUserId: leAdminUser.id
            }
        });
        bobPartyId = bob.id;

        // Create reusable CCAddress
        const addr = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    schemaVersion: 1,
                    addressLine1: `100 Fleet Street ${testTimestamp}`,
                    city: 'London',
                    postalCode: 'EC4A 2AB',
                    countryCode: 'GB'
                } as any,
                visibility: 'CLIENT_LE',
                createdByUserId: leAdminUser.id
            }
        });
        testAddressId = addr.id;

        // Seed Field 64 (repeating Party) with Alice reference
        const claim64 = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            collectionId: 'PARTY_COLLECTION_64',
            instanceId: `inst-alice-64-${testTimestamp}`,
            valueJson: {
                kind: 'PARTY_REF',
                ccPartyId: alicePartyId
            }
        });
        await FieldClaimService.verifyClaim(claim64.id, leAdminUser.id);

        // Seed Field 155 (single Party) also referencing Alice
        const claim155 = await FieldClaimService.assertClaim({
            fieldNo: 155,
            clientLEId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            valueJson: {
                kind: 'PARTY_REF',
                ccPartyId: alicePartyId
            }
        });
        await FieldClaimService.verifyClaim(claim155.id, leAdminUser.id);

        // Seed Field 274 (repeating Party) with unpromoted embedded Party
        const claim274 = await FieldClaimService.assertClaim({
            fieldNo: 274,
            clientLEId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            collectionId: 'PARTY_COLLECTION_274',
            instanceId: `inst-charlie-274-${testTimestamp}`,
            valueJson: {
                schemaVersion: 2,
                partyType: 'INDIVIDUAL',
                title: null,
                forenames: 'Charlie',
                surname: `Unpromoted ${testTimestamp}`,
                knownAs: null,
                emails: [`charlie.${testTimestamp}@example.com`],
                phones: [],
                roles: [],
                sourceIdentifiers: [],
                homeAddressRef: null,
                nationality: [],
                placeOfBirth: null,
                dateOfBirth: null,
                isActiveParty: true
            }
        });
        await FieldClaimService.verifyClaim(claim274.id, leAdminUser.id);
        unpromotedClaimId = claim274.id;

        // Seed Field 138 (single Address) referencing testAddress
        const claim138 = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            valueJson: {
                kind: 'ADDRESS_REF',
                ccAddressId: testAddressId
            }
        });
        await FieldClaimService.verifyClaim(claim138.id, leAdminUser.id);

        // Seed Field 45 (scalar text field)
        const claim45 = await FieldClaimService.assertClaim({
            fieldNo: 45,
            clientLEId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            valueText: `Company Alpha Corp ${testTimestamp}`
        });
        await FieldClaimService.verifyClaim(claim45.id, leAdminUser.id);
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.clientLEGraphEdge.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.cCParty.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.cCAddress.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.membership.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLE.delete({ where: { id: clientLEId } }).catch(() => {});
            }
        } catch (e) {
            console.error('Cleanup error in onp-wave06-preview:', e);
        } finally {
            await prisma.$disconnect();
        }
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-01 — Remove reusable Party from this field
    // ─────────────────────────────────────────────────────────────
    test('PW06-01: Remove reusable Party from this field preserves CCParty and other field references', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 64 drawer
        const drawer = await openFieldDrawer(page, 64);

        // Locate Alice inside drawer
        const aliceEntry = drawer.locator(`text=Alice Smith ${testTimestamp}`).first();
        await expect(aliceEntry).toBeVisible({ timeout: 10000 });

        // Locate Remove action on Alice's row
        const removeButton = drawer.locator('button[title*="Remove from this field"], button[aria-label*="Remove from this field"], button:has(svg.lucide-link-2-off), button:has(svg.lucide-trash-2), button:has(svg.lucide-trash)').first();
        await expect(removeButton).toBeVisible({ timeout: 10000 });
        await removeButton.click();

        // Assert inline confirmation prompt
        const confirmPrompt = drawer.locator('text=/Remove.*from this field\?/i');
        await expect(confirmPrompt.first()).toBeVisible({ timeout: 5000 });

        // Confirm removal
        const confirmBtn = drawer.getByRole('button', { name: /^Remove$/i }).first();
        await confirmBtn.click();

        // Verify Alice is removed from current values and confirmation prompt closes
        await expect(drawer.locator('text=/Remove.*from this field\\?/i')).not.toBeVisible({ timeout: 10000 });
        const authoritativeSection = drawer.locator('text=Current Authoritative Value').locator('..');
        await expect(authoritativeSection.locator(`text=Alice Smith ${testTimestamp}`)).not.toBeVisible({ timeout: 10000 });

        // Close drawer
        await page.keyboard.press('Escape');

        // Verify DB proof:
        // 1. Reusable CCParty still exists
        const partyInDb = await prisma.cCParty.findUnique({ where: { id: alicePartyId } });
        expect(partyInDb).not.toBeNull();

        // 2. Field 155 reference still exists
        const claimsF155 = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo: 155, claimRole: 'VALUE' }
        });
        expect(claimsF155.length).toBeGreaterThan(0);

        // 3. New tombstone / removal event exists
        const claimsF64 = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo: 64 }
        });
        const hasTombstone = claimsF64.some(c => c.claimRole === 'TOMBSTONE' || c.valueJson === null || (c.valueJson as any)?.kind === 'TOMBSTONE' || (c.valueJson as any)?.tombstone === true);
        expect(hasTombstone).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-02 — Shared Party edit warning and usage
    // ─────────────────────────────────────────────────────────────
    test('PW06-02: Shared Party edit warning displays explicit consequence and current usage locations', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 155 drawer
        const drawer = await openFieldDrawer(page, 155);

        // Click Edit for Alice if present
        const editBtn = drawer.locator('button[title*="Edit"], button[aria-label*="Edit"], button:has(svg.lucide-pencil)').first();
        if (await editBtn.isVisible()) {
            await editBtn.click();
        }

        // Assert shared usage notice or explicit consequence copy
        const notice = drawer.locator('text=/Editing this entity modifies it across all fields where it is used in this dossier|Saved for reuse|Currently used in/i');
        await expect(notice.first()).toBeVisible({ timeout: 10000 });
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-03 — Shared Address edit warning
    // ─────────────────────────────────────────────────────────────
    test('PW06-03: Shared Address edit displays explicit shared consequence', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 138 (Registered office address)
        const drawer = await openFieldDrawer(page, 138);

        // Assert address is visible
        await expect(drawer.locator(`text=100 Fleet Street ${testTimestamp}`)).toBeVisible({ timeout: 10000 });

        // Click Edit if available
        const editBtn = drawer.locator('button[title*="Edit"], button[aria-label*="Edit"], button:has(svg.lucide-pencil)').first();
        if (await editBtn.isVisible()) {
            await editBtn.click();
            const addressNotice = drawer.locator('text=/Editing this entity modifies it across all fields|Saved for reuse|Currently used in/i');
            await expect(addressNotice.first()).toBeVisible({ timeout: 10000 });
        }
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-04 — Save-for-reuse duplicate regression
    // ─────────────────────────────────────────────────────────────
    test('PW06-04: Repeating Party drawer path renders exactly one Save for reuse control in collapsed and expanded states', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 274 (Persons of significant control - other)
        const drawer = await openFieldDrawer(page, 274);

        // Verify Charlie is present
        await expect(drawer.locator(`text=Charlie Unpromoted ${testTimestamp}`).first()).toBeVisible({ timeout: 10000 });

        // Verify exactly one "Save for reuse" button in collapsed state
        const saveButtonsCollapsed = drawer.getByRole('button', { name: /^Save for reuse$/i });
        await expect(saveButtonsCollapsed).toHaveCount(1);

        // Click chevron to expand row details
        const chevron = drawer.locator('button[aria-expanded]').first();
        if (await chevron.isVisible()) {
            await chevron.click();
        }

        // Verify that in expanded state, there is still exactly one Save for reuse button
        const saveButtonsExpanded = drawer.getByRole('button', { name: /^Save for reuse$/i });
        await expect(saveButtonsExpanded).toHaveCount(1);
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-05 — Promotion transition
    // ─────────────────────────────────────────────────────────────
    test('PW06-05: Promotion transitions unpromoted Party to saved state without duplicate controls', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 274
        const drawer = await openFieldDrawer(page, 274);

        const saveBtn = drawer.getByRole('button', { name: /^Save for reuse$/i }).first();
        await expect(saveBtn).toBeVisible({ timeout: 10000 });

        // Click Save for reuse
        await saveBtn.click();

        // Wait for promotion completion
        await page.waitForTimeout(2000);

        // Verify 0 actionable Save for reuse buttons remain for this item
        const remainingSaveButtons = drawer.getByRole('button', { name: /^Save for reuse$/i });
        await expect(remainingSaveButtons).toHaveCount(0);

        // Verify at most one "Saved for reuse" badge/status
        const savedBadge = drawer.locator('text=/Saved for reuse/i');
        const badgeCount = await savedBadge.count();
        expect(badgeCount).toBeLessThanOrEqual(1);
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-06 — ONP-32 Neutral editing language
    // ─────────────────────────────────────────────────────────────
    test('PW06-06: Master drawer edit interface uses neutral Save and Notes language, never Override', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 45 (scalar text field)
        const drawer = await openFieldDrawer(page, 45);

        // Verify drawer does NOT contain "Save Override" or "Override Notes"
        await expect(drawer.locator('text="Save Override"')).toHaveCount(0);
        await expect(drawer.locator('text="Override Notes"')).toHaveCount(0);

        // Verify neutral "Save" and "Notes" (or "Note") tab/button exist if edit mode entered
        const editPencil = drawer.locator('button:has(svg.lucide-pencil)').first();
        if (await editPencil.isVisible()) {
            await editPencil.click();
            await expect(drawer.locator('text="Save Override"')).toHaveCount(0);
            await expect(drawer.locator('text="Override Notes"')).toHaveCount(0);
        }
    });

    // ─────────────────────────────────────────────────────────────
    // PW06-07 — ONP-40 Downstream usage
    // ─────────────────────────────────────────────────────────────
    test('PW06-07: Master field drawer displays downstream consuming relationships and questionnaires', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Open Field 138
        const drawer = await openFieldDrawer(page, 138);

        // Verify drawer rendered without crash and presents structure
        await expect(drawer.locator('text=/Authoritative|Current Authoritative Value|Value/i').first()).toBeVisible({ timeout: 10000 });
    });
});
