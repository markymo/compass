import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loadUATManifest, PERSONA_STORAGE_STATES, UATActorKey } from './fixtures/uat-fixture';

setup.describe('UAT Phase 2 — Automated Persona Authentication Setup', () => {
    setup('authenticate all 9 synthetic UAT actors and validate reusable sessions', async ({ browser, page }) => {
        setup.setTimeout(120000);

        const uatPassword = process.env.UAT_PASSWORD;
        if (!uatPassword || uatPassword.trim() === '') {
            throw new Error('UAT_PASSWORD environment variable is required and must not be empty.');
        }

        const manifest = loadUATManifest();
        const authDir = path.join(process.cwd(), 'playwright', '.auth');
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        const actorKeys = Object.keys(PERSONA_STORAGE_STATES) as UATActorKey[];

        console.log(`🔐 Starting Playwright authentication setup for ${actorKeys.length} UAT personas...`);

        for (const key of actorKeys) {
            const actor = manifest.actors[key];
            if (!actor) {
                throw new Error(`Actor definition for "${key}" not found in fixture manifest.`);
            }

            const storageStateRel = PERSONA_STORAGE_STATES[key];
            const storageStateFull = path.join(process.cwd(), storageStateRel);

            console.log(`  ➔ Authenticating [${key}] (${actor.email} / ${actor.role})...`);

            const loginContext = await browser.newContext();
            const loginPage = await loginContext.newPage();

            try {
                // 1. Navigate to login page
                await loginPage.goto('/login');
                await expect(loginPage.getByLabel('Email')).toBeVisible();

                // 2. Fill credentials
                await loginPage.getByLabel('Email').fill(actor.email);
                await loginPage.getByLabel('Password').fill(uatPassword);

                // 3. Submit credentials
                await loginPage.getByRole('button', { name: 'Sign In' }).click();

                // 4. Verify successful navigation away from /login to /app
                await loginPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
                await expect(loginPage).toHaveURL(/\/app/);

                // 5. Save storageState
                await loginContext.storageState({ path: storageStateFull });
                console.log(`    ✓ Saved storageState to ${storageStateRel}`);
            } finally {
                await loginContext.close();
            }

            // 6. Secondary Session Validation: Verify storageState reopens /app without login redirect
            const sessionContext = await browser.newContext({ storageState: storageStateFull });
            const sessionPage = await sessionContext.newPage();
            try {
                await sessionPage.goto('/app', { waitUntil: 'domcontentloaded' });
                await sessionPage.waitForLoadState('networkidle');
                const finalUrl = sessionPage.url();

                if (finalUrl.includes('/login')) {
                    throw new Error(`Session validation failed for ${actor.email}: Redirected to login (${finalUrl})`);
                }

                await expect(sessionPage).toHaveURL(/\/app/);
                console.log(`    ✓ Reusable session validated for ${actor.email}`);
            } finally {
                await sessionContext.close();
            }
        }

        console.log('✅ All 9 UAT personas authenticated and validated successfully.');
    });
});
