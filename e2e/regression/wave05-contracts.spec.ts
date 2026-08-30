import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Authoritative Wave 05 Contracts:
// - ONP-95 / EDIT-01 / EDIT-02 / EDIT-03: Master value edit hydration & claim immutability
// - ONP-52 / ADDR-01: Country dropdown popup overlay interaction
// - ONP-46 / PARTY-02: Scoped Party evidence vs field-level evidence

const prisma = new PrismaClient();

test.describe('Wave 05 — Master Value Editing, Address Overlay & Scoped Evidence Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let subjectLeId: string;
    let leAdminUserId: string;

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
        if (!leAdminUser) throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found`);
        leAdminUserId = leAdminUser.id;

        // Create disposable LegalEntity
        const le = await prisma.legalEntity.create({
            data: {
                name: `Wave 05 Contract Verification LE ${testTimestamp}`,
                reference: `REF-W05-${testTimestamp}`
            }
        });
        subjectLeId = le.id;

        // Create disposable ClientLE with LE_ADMIN membership
        const disposableCLE = await prisma.clientLE.create({
            data: {
                shortCode: `cle_w05_${testTimestamp}`,
                name: `Wave 05 Verification CLE ${testTimestamp}`,
                legalEntityId: subjectLeId,
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
        clientLEId = disposableCLE.id;

        // 1. Seed ONP-95 claims for Field 45 (Fund Manager - TEXT)
        // Older claim (2025-01-01): explicitNone sentinel
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 45,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                sourceReference: 'OLD-ASSERTION',
                valueJson: { explicitNone: true },
                assertedAt: new Date('2025-01-01T10:00:00.000Z'),
                verifiedAt: new Date('2025-01-01T10:00:00.000Z')
            }
        });

        // Newer authoritative claim (2026-08-01): real scalar value
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 45,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: 'CH-RECORD-45',
                valueText: 'Heritage Capital Management',
                assertedAt: new Date('2026-08-01T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-01T10:00:00.000Z')
            }
        });

        // 2. Seed ONP-52 claims for Field 138 (Registered Address - ADDRESS)
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 138,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: 'CH-ADDR-138',
                valueJson: {
                    line1: '100 London Wall',
                    locality: 'London',
                    region: 'Greater London',
                    postalCode: 'EC2M 5QQ',
                    countryCode: 'GB',
                    countryName: 'United Kingdom'
                },
                assertedAt: new Date('2026-08-01T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-01T10:00:00.000Z')
            }
        });

        // 3. Seed ONP-46 Dual-Scope Evidence for Field 64 (PSCs - PARTY)
        // Alice CCParty
        const aliceParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                partyType: 'INDIVIDUAL',
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    forenames: 'Alice',
                    surname: 'Smith',
                    roles: [{ roleType: 'PSC', roleTitle: 'Significant Controller', isActiveRole: true }]
                }
            }
        });

        // Bob CCParty
        const bobParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                partyType: 'INDIVIDUAL',
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    forenames: 'Bob',
                    surname: 'Jones',
                    roles: [{ roleType: 'PSC', roleTitle: 'Significant Controller', isActiveRole: true }]
                }
            }
        });

        // Party claims in Field 64
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 64,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                instanceId: 'inst-alice-64',
                valueJson: { ccPartyId: aliceParty.id },
                assertedAt: new Date('2026-08-01T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-01T10:00:00.000Z')
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 64,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                instanceId: 'inst-bob-64',
                valueJson: { ccPartyId: bobParty.id },
                assertedAt: new Date('2026-08-01T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-01T10:00:00.000Z')
            }
        });

        // Documents:
        // Alice party document
        const aliceDoc = await prisma.document.create({
            data: {
                clientLEId,
                name: 'alice-passport.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 1024,
                blobUrl: 'https://example.com/alice-passport.pdf',
                uploadedById: leAdminUserId
            }
        });
        await prisma.cCPartyDocument.create({
            data: {
                partyId: aliceParty.id,
                documentId: aliceDoc.id,
                operation: 'ATTACH',
                instanceId: 'pdoc-alice-1',
                assertedById: leAdminUserId
            }
        });

        // Bob party document
        const bobDoc = await prisma.document.create({
            data: {
                clientLEId,
                name: 'bob-passport.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 2048,
                blobUrl: 'https://example.com/bob-passport.pdf',
                uploadedById: leAdminUserId
            }
        });
        await prisma.cCPartyDocument.create({
            data: {
                partyId: bobParty.id,
                documentId: bobDoc.id,
                operation: 'ATTACH',
                instanceId: 'pdoc-bob-1',
                assertedById: leAdminUserId
            }
        });

        // Field-level attachment document for Field 64
        const fieldDoc = await prisma.document.create({
            data: {
                clientLEId,
                name: 'field-psc-audit-note.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 4096,
                blobUrl: 'https://example.com/field-psc-audit-note.pdf',
                uploadedById: leAdminUserId
            }
        });
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo: 64,
                claimRole: 'ATTACHMENT',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                attachmentDocumentId: fieldDoc.id,
                instanceId: 'fatt-64-1',
                assertedAt: new Date('2026-08-01T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-01T10:00:00.000Z')
            }
        });
    });

    test.afterAll(async () => {
        if (!clientLEId) return;
        try {
            await prisma.cCPartyDocument.deleteMany({ where: { party: { clientLEId } } }).catch(() => {});
            await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
            await prisma.cCParty.deleteMany({ where: { clientLEId } }).catch(() => {});
            await prisma.document.deleteMany({ where: { clientLEId } }).catch(() => {});
            await prisma.clientLE.deleteMany({ where: { id: clientLEId } }).catch(() => {});
            if (subjectLeId) {
                await prisma.legalEntity.deleteMany({ where: { id: subjectLeId } }).catch(() => {});
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. ONP-95: Master edit hydrates authoritative semantic value, never raw explicitNone sentinel, and preserves prior claim immutability', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 45 card
        const field45Card = page.locator('[data-field-no="45"]').first();
        await expect(field45Card).toBeVisible({ timeout: 20000 });

        // Assert read-only display shows current winning non-empty value
        await expect(field45Card).toContainText('Heritage Capital Management');

        // Click Field 45 to open the inspection drawer
        await field45Card.click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 15000 });

        // Click Edit pencil button
        const editBtn = drawer.locator('button:has(svg.lucide-pencil)').first();
        await expect(editBtn).toBeVisible({ timeout: 10000 });
        await editBtn.click();

        // Assert editor input is hydrated with the current semantic value
        const input = drawer.locator('input[type="text"]').first();
        await expect(input).toBeVisible({ timeout: 10000 });
        await expect(input).toHaveValue('Heritage Capital Management');

        // Assert no explicitNone sentinel or raw JSON leaks into input or drawer
        const inputValue = await input.inputValue();
        expect(inputValue).not.toContain('explicitNone');
        expect(inputValue).not.toContain('{');
        const drawerText = await drawer.textContent();
        expect(drawerText).not.toContain('{"explicitNone":true}');

        // Modify value to Apex Global Partners
        await input.fill('Apex Global Partners');

        // Click Save
        const saveBtn = drawer.locator('button:has-text("Save")').first();
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();

        // Assert UI reflects new winning value
        await expect(drawer).toContainText('Apex Global Partners');

        // Close drawer
        const closeBtn = drawer.locator('button:has(svg.lucide-x), button[aria-label="Close"]').first();
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
        }

        // Exact DB assertions verifying immutability:
        const claimsInDb = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo: 45, claimRole: 'VALUE' },
            orderBy: { assertedAt: 'asc' }
        });

        expect(claimsInDb.length).toBe(3);

        // Claim 1: Old explicit-None claim remains unchanged
        expect(claimsInDb[0].sourceType).toBe('USER_INPUT');
        expect(JSON.stringify(claimsInDb[0].valueJson)).toContain('explicitNone');

        // Claim 2: Intermediate Companies House claim remains unchanged
        expect(claimsInDb[1].sourceType).toBe('COMPANIES_HOUSE');
        expect(claimsInDb[1].valueText).toBe('Heritage Capital Management');

        // Claim 3: New replacement claim was created as USER_INPUT
        expect(claimsInDb[2].sourceType).toBe('USER_INPUT');
        expect(claimsInDb[2].valueText).toBe('Apex Global Partners');
    });

    test('2. ONP-52: Existing Address editor Country dropdown renders elevated popover and allows country selection inside drawer modal', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 138 card (Registered address)
        const field138Card = page.locator('[data-field-no="138"]').first();
        await expect(field138Card).toBeVisible({ timeout: 20000 });
        await field138Card.click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 15000 });

        // Enter Edit mode
        const editBtn = drawer.locator('button:has(svg.lucide-pencil)').first();
        await expect(editBtn).toBeVisible({ timeout: 10000 });
        await editBtn.click();

        // Locate Country Combobox trigger
        const countryTrigger = drawer.locator('button[role="combobox"]').first();
        await expect(countryTrigger).toBeVisible({ timeout: 10000 });
        await expect(countryTrigger).toContainText('United Kingdom');

        // Open Country popover dropdown
        await countryTrigger.click();

        // Locate the elevated popover overlay
        const searchInput = page.locator('input[placeholder="Search country..."]').first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });

        // Search for Germany
        await searchInput.fill('Germany');

        // Select Germany option
        const germanyOption = page.locator('[role="option"]:has-text("Germany"), [cmdk-item]:has-text("Germany")').first();
        await expect(germanyOption).toBeVisible({ timeout: 10000 });
        await germanyOption.click();

        // Verify country button updated in editor
        await expect(countryTrigger).toContainText('Germany');

        // Click Save
        const saveBtn = drawer.locator('button:has-text("Save")').first();
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();

        // Verify drawer display reflects Germany
        await expect(drawer).toContainText('Germany');
    });

    test('3. ONP-46: Dual-scope evidence properly separates Party-specific attachments from field-level attachments', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 64 (PSCs)
        const field64Card = page.locator('[data-field-no="64"]').first();
        await expect(field64Card).toBeVisible({ timeout: 20000 });
        await field64Card.click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 15000 });

        // Locate Alice card and Bob card within the drawer
        const aliceRow = drawer.locator('div:has-text("Alice Smith")').first();
        await expect(aliceRow).toBeVisible({ timeout: 15000 });

        const bobRow = drawer.locator('div:has-text("Bob Jones")').first();
        await expect(bobRow).toBeVisible({ timeout: 15000 });

        // Alice must display her document
        await expect(drawer.locator('text="alice-passport.pdf"').first()).toBeVisible({ timeout: 10000 });

        // Bob must display his document
        await expect(drawer.locator('text="bob-passport.pdf"').first()).toBeVisible({ timeout: 10000 });

        // Bottom Field Attachments section displays the field-level document
        const fieldAttachmentsSection = drawer.locator('div:has-text("Field Attachments")').last();
        await expect(fieldAttachmentsSection).toBeVisible({ timeout: 10000 });
        await expect(fieldAttachmentsSection.locator('text="field-psc-audit-note.pdf"')).toBeVisible({ timeout: 10000 });
    });
});
