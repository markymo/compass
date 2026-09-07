/**
 * ONP-12 THEME ARCHITECTURE & CONTRAST REGRESSION SUITE (Isolated Local Runner)
 *
 * Tests the OnPro CSS theme token matrix, class strategy, and luminance contrast ratios:
 * 1. Light Baseline Mode: Ensures light theme renders #ffffff canvas with slate 900 typography.
 * 2. Explicit Dark Mode: Ensures dark theme applies slate 950 surface tones (#090d16) and passes WCAG >= 4.5:1 contrast ratio.
 * 3. System Mode + OS Dark: Emulates prefers-color-scheme: dark, verifies automatic dark theme activation.
 * 4. Explicit Light Mode + OS Dark: Emulates prefers-color-scheme: dark with explicit light theme, verifying no corrupted dark hybrid UI.
 */

import { test, expect } from '@playwright/test';

// Helper function to calculate relative luminance according to WCAG 2.1
function getLuminance(rgbStr: string): number {
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return 0;
    const [r, g, b] = match.slice(0, 3).map(Number).map(v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Helper function to calculate contrast ratio between two RGB color strings
function getContrastRatio(rgb1: string, rgb2: string): number {
    const l1 = getLuminance(rgb1);
    const l2 = getLuminance(rgb2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (brighter + 0.05) / (darker + 0.05);
}

const HTML_TEST_BED = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root {
      --background: #ffffff;
      --foreground: #0f172a;
      --card: #ffffff;
      --card-foreground: #0f172a;
      --secondary: #f1f5f9;
      --secondary-foreground: #334155;
      --muted: #f8fafc;
      --muted-foreground: #64748b;
      --border: #e2e8f0;
    }
    .dark {
      --background: #090d16;
      --foreground: #f8fafc;
      --card: #111726;
      --card-foreground: #f8fafc;
      --secondary: #1e293b;
      --secondary-foreground: #cbd5e1;
      --muted: #1e293b;
      --muted-foreground: #94a3b8;
      --border: #1e293b;
    }
    @media (prefers-color-scheme: dark) {
      html:not(.light) {
        --background: #090d16;
        --foreground: #f8fafc;
        --card: #111726;
        --card-foreground: #f8fafc;
        --secondary-foreground: #cbd5e1;
        --muted-foreground: #94a3b8;
      }
    }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: sans-serif;
    }
    .card {
      background-color: var(--card);
      color: var(--card-foreground);
      border: 1px solid var(--border);
      padding: 1rem;
    }
    .secondary-text {
      color: var(--secondary-foreground);
    }
    .muted-text {
      color: var(--muted-foreground);
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>OnPro Platform Header</h1>
    <div class="card" id="user-card">
      <p id="user-email">user@onpro.tech</p>
      <span class="secondary-text" id="org-name">ZZOOMM GROUP LIMITED</span>
      <span class="muted-text" id="user-role">(ORG_ADMIN)</span>
    </div>
  </div>
</body>
</html>
`;

test.describe('ONP-12 Theme Architecture & Contrast Regression Suite', () => {

    test('1. Light Baseline Mode renders light background and navy headings', async ({ page }) => {
        await page.setContent(HTML_TEST_BED);
        await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        });

        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const color = await page.evaluate(() => getComputedStyle(document.body).color);

        // Background should be white (RGB 255, 255, 255)
        expect(bg).toContain('255, 255, 255');
        
        // Body text contrast ratio against background should be >= 4.5:1
        const contrast = getContrastRatio(bg, color);
        expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    test('2. Explicit Dark Mode applies dark surfaces and passes WCAG >= 4.5:1 contrast', async ({ page }) => {
        await page.setContent(HTML_TEST_BED);
        await page.evaluate(() => {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
        });

        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('user-card')!).backgroundColor);
        const emailColor = await page.evaluate(() => getComputedStyle(document.getElementById('user-email')!).color);
        const orgColor = await page.evaluate(() => getComputedStyle(document.getElementById('org-name')!).color);

        // User email text contrast ratio on dark card background must be >= 4.5:1
        const emailContrast = getContrastRatio(cardBg, emailColor);
        expect(emailContrast).toBeGreaterThanOrEqual(4.5);

        // Secondary text (org name) contrast ratio on dark card background must be >= 4.5:1
        const orgContrast = getContrastRatio(cardBg, orgColor);
        expect(orgContrast).toBeGreaterThanOrEqual(4.5);
    });

    test('3. System Mode + OS Dark activates dark class / variables', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.setContent(HTML_TEST_BED);
        
        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('user-card')!).backgroundColor);
        const emailColor = await page.evaluate(() => getComputedStyle(document.getElementById('user-email')!).color);

        // Contrast ratio must be >= 4.5:1 under system dark mode
        const contrast = getContrastRatio(cardBg, emailColor);
        expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    test('4. Explicit Light Mode + OS Dark prevents corrupted dark hybrid UI', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.setContent(HTML_TEST_BED);
        
        // Force explicit light mode
        await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        });

        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bg).toContain('255, 255, 255');
    });

    test('5. Minimal 404 text page in Dark Mode passes WCAG >= 4.5:1 contrast', async ({ page }) => {
        const NOT_FOUND_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { display: flex; align-items: center; gap: 1rem; }
            h1 { font-size: 1.5rem; font-weight: 500; border-right: 1px solid var(--border); padding-right: 1rem; margin: 0; }
            h2 { font-size: 0.875rem; font-weight: 400; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 id="error-404">404</h1>
            <h2 id="error-msg">This page could not be found.</h2>
          </div>
        </body>
        </html>
        `;
        await page.setContent(NOT_FOUND_HTML);

        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const h1Color = await page.evaluate(() => getComputedStyle(document.getElementById('error-404')!).color);
        const h2Color = await page.evaluate(() => getComputedStyle(document.getElementById('error-msg')!).color);

        expect(getContrastRatio(bodyBg, h1Color)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(bodyBg, h2Color)).toBeGreaterThanOrEqual(4.5);
    });

    test('6. Master Record (/master) Surface in Dark Mode passes WCAG >= 4.5:1 contrast for labels and values', async ({ page }) => {
        const MASTER_SURFACE_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --card: #111726;
              --card-foreground: #f8fafc;
              --muted: #1e293b;
              --muted-foreground: #94a3b8;
              --secondary-foreground: #cbd5e1;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; padding: 2rem; }
            .external-sources { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1rem; border-radius: 0.75rem; }
            .field-label { color: var(--secondary-foreground); font-size: 0.875rem; font-weight: 500; }
            .field-box { background: var(--muted); color: var(--card-foreground); border: 1px solid var(--border); padding: 0.75rem; border-radius: 0.375rem; }
            .field-value { color: var(--foreground); font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="external-sources" id="ext-sources">
            <h2>External Sources</h2>
          </div>
          <div class="field-item">
            <label class="field-label" id="field-lbl">Legal Name</label>
            <div class="field-box" id="f-box">
              <span class="field-value" id="f-val">ACME HOLDINGS LIMITED</span>
            </div>
          </div>
        </body>
        </html>
        `;
        await page.setContent(MASTER_SURFACE_HTML);

        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('ext-sources')!).backgroundColor);
        const cardColor = await page.evaluate(() => getComputedStyle(document.getElementById('ext-sources')!).color);
        const labelColor = await page.evaluate(() => getComputedStyle(document.getElementById('field-lbl')!).color);
        const boxBg = await page.evaluate(() => getComputedStyle(document.getElementById('f-box')!).backgroundColor);
        const valColor = await page.evaluate(() => getComputedStyle(document.getElementById('f-val')!).color);

        expect(getContrastRatio(cardBg, cardColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, labelColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(boxBg, valColor)).toBeGreaterThanOrEqual(4.5);
    });

    test('7. Supplier Relationships (/relationships) Surface in Dark Mode passes WCAG >= 4.5:1 contrast across headers, cards and sub-sections', async ({ page }) => {
        const RELATIONSHIPS_SURFACE_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --card: #111726;
              --card-foreground: #f8fafc;
              --muted: #1e293b;
              --muted-foreground: #94a3b8;
              --secondary-foreground: #cbd5e1;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; padding: 2rem; }
            .section-title { color: var(--foreground); font-size: 1.25rem; font-weight: 600; }
            .table-header { background: rgba(30, 41, 59, 0.8); color: var(--foreground); border: 1px solid var(--border); padding: 0.5rem 1rem; }
            .header-label { color: var(--muted-foreground); font-size: 0.625rem; font-weight: 700; text-transform: uppercase; }
            .relationship-card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1rem; border-radius: 0.375rem; margin-top: 0.75rem; }
            .rel-org-name { color: var(--foreground); font-size: 0.9375rem; font-weight: 700; }
            .rel-subtitle { color: var(--muted-foreground); font-size: 0.75rem; }
            .sub-header { background: rgba(30, 41, 59, 0.5); color: var(--foreground); border-bottom: 1px solid var(--border); padding: 0.625rem 1rem; }
            .sub-header-title { color: var(--foreground); font-weight: 600; font-size: 0.875rem; }
            .empty-state { background: var(--card); color: var(--card-foreground); border: 2px dashed var(--border); padding: 2.5rem; text-align: center; border-radius: 0.375rem; margin-top: 1rem; }
            .empty-title { color: var(--foreground); font-weight: 500; }
            .empty-sub { color: var(--muted-foreground); font-size: 0.875rem; }
          </style>
        </head>
        <body>
          <h2 class="section-title" id="sec-title">Supplier Relationships</h2>
          <div class="table-header" id="tbl-hdr">
            <span class="header-label" id="hdr-lbl">Supplier Relationships</span>
          </div>
          <div class="relationship-card" id="rel-card">
            <h3 class="rel-org-name" id="rel-name">Acme Financial Services</h3>
            <span class="rel-subtitle" id="rel-sub">Supplier Relationship</span>
          </div>
          <div class="sub-header" id="sub-hdr">
            <span class="sub-header-title" id="sub-hdr-title">Overview</span>
          </div>
          <div class="empty-state" id="empty-box">
            <p class="empty-title" id="empty-txt">No Common Questionnaires added yet.</p>
            <p class="empty-sub" id="empty-subtxt">Use the + Add button to search and add standard questionnaires.</p>
          </div>
        </body>
        </html>
        `;
        await page.setContent(RELATIONSHIPS_SURFACE_HTML);

        const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const titleColor = await page.evaluate(() => getComputedStyle(document.getElementById('sec-title')!).color);
        const headerBg = await page.evaluate(() => getComputedStyle(document.getElementById('tbl-hdr')!).backgroundColor);
        const headerLabelColor = await page.evaluate(() => getComputedStyle(document.getElementById('hdr-lbl')!).color);
        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('rel-card')!).backgroundColor);
        const orgNameColor = await page.evaluate(() => getComputedStyle(document.getElementById('rel-name')!).color);
        const relSubColor = await page.evaluate(() => getComputedStyle(document.getElementById('rel-sub')!).color);
        const subHdrBg = await page.evaluate(() => getComputedStyle(document.getElementById('sub-hdr')!).backgroundColor);
        const subHdrTitleColor = await page.evaluate(() => getComputedStyle(document.getElementById('sub-hdr-title')!).color);
        const emptyBg = await page.evaluate(() => getComputedStyle(document.getElementById('empty-box')!).backgroundColor);
        const emptyTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('empty-txt')!).color);
        const emptySubtxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('empty-subtxt')!).color);

        expect(getContrastRatio(pageBg, titleColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(headerBg, headerLabelColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, orgNameColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, relSubColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(subHdrBg, subHdrTitleColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(emptyBg, emptyTxtColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(emptyBg, emptySubtxtColor)).toBeGreaterThanOrEqual(4.5);
    });

    test('8. Question Bank (/workbench4) Surface in Dark Mode passes WCAG >= 4.5:1 contrast across toolbar, cards, and compact table', async ({ page }) => {
        const WORKBENCH_SURFACE_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --card: #111726;
              --card-foreground: #f8fafc;
              --muted: #1e293b;
              --muted-foreground: #94a3b8;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; padding: 2rem; }
            .toolbar { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1rem; border-radius: 0.375rem; }
            .search-input { background: rgba(30, 41, 59, 0.5); color: var(--foreground); border: 1px solid var(--border); padding: 0.5rem; }
            .q-card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1rem; border-radius: 0.375rem; margin-top: 1rem; }
            .q-title { color: var(--foreground); font-size: 0.875rem; font-weight: 500; }
            .q-label { color: var(--muted-foreground); font-weight: 700; }
            .a-box { background: rgba(30, 41, 59, 0.4); color: var(--foreground); border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 0.25rem; margin-top: 0.5rem; }
            .table-head { background: rgba(30, 41, 59, 0.8); color: var(--muted-foreground); border-bottom: 1px solid var(--border); padding: 0.5rem; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; }
            .table-cell-q { color: var(--foreground); font-size: 0.75rem; }
          </style>
        </head>
        <body>
          <div class="toolbar" id="wb-toolbar">
            <input class="search-input" id="wb-search" value="Search questions..." />
          </div>
          <div class="q-card" id="wb-card">
            <span class="q-label" id="wb-q-lbl">Q:</span>
            <span class="q-title" id="wb-q-txt">What is the legal name of the entity?</span>
            <div class="a-box" id="wb-a-box">
              <span id="wb-a-txt">Acme Corporation Inc.</span>
            </div>
          </div>
          <div class="table-head" id="wb-th">
            <span id="wb-th-txt">Status & Actions</span>
          </div>
          <div class="table-cell-q" id="wb-tc">
            <span id="wb-tc-txt">What is your principal place of business?</span>
          </div>
        </body>
        </html>
        `;
        await page.setContent(WORKBENCH_SURFACE_HTML);

        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('wb-card')!).backgroundColor);
        const qTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('wb-q-txt')!).color);
        const qLblColor = await page.evaluate(() => getComputedStyle(document.getElementById('wb-q-lbl')!).color);
        const aBoxBg = await page.evaluate(() => getComputedStyle(document.getElementById('wb-a-box')!).backgroundColor);
        const aTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('wb-a-txt')!).color);
        const thBg = await page.evaluate(() => getComputedStyle(document.getElementById('wb-th')!).backgroundColor);
        const thTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('wb-th-txt')!).color);

        expect(getContrastRatio(cardBg, qTxtColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, qLblColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(aBoxBg, aTxtColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(thBg, thTxtColor)).toBeGreaterThanOrEqual(4.5);
    });

    test('9. Global Assignments (/app/assignments) Surface in Dark Mode passes WCAG >= 4.5:1 contrast across tabs, summary bar, controls, and task rows', async ({ page }) => {
        const ASSIGNMENTS_SURFACE_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --card: #111726;
              --card-foreground: #f8fafc;
              --muted: #1e293b;
              --muted-foreground: #94a3b8;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; padding: 2rem; }
            .tab-list { background: var(--muted); border: 1px solid var(--border); padding: 0.25rem; border-radius: 0.75rem; display: inline-flex; }
            .tab-active { background: var(--card); color: var(--foreground); padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 600; }
            .summary-bar { background: rgba(49, 46, 129, 0.4); color: #c7d2fe; border: 1px solid #3730a3; padding: 0.625rem 1rem; border-radius: 0.375rem; margin-top: 1rem; }
            .summary-title { color: #f8fafc; font-weight: 600; }
            .controls { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 0.75rem; border-radius: 0.375rem; margin-top: 1rem; }
            .search-input { background: rgba(30, 41, 59, 0.5); color: var(--foreground); border: 1px solid var(--border); padding: 0.5rem; }
            .task-card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1rem; border-radius: 0.375rem; margin-top: 1rem; }
            .task-title { color: var(--foreground); font-weight: 600; font-size: 0.875rem; }
            .task-context { color: var(--muted-foreground); font-size: 0.75rem; }
            .note-box { background: rgba(49, 46, 129, 0.4); color: #c7d2fe; border: 1px solid #3730a3; padding: 0.5rem; border-radius: 0.25rem; margin-top: 0.5rem; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="tab-list" id="ass-tabs">
            <span class="tab-active" id="ass-tab-act">My ToDo</span>
          </div>
          <div class="summary-bar" id="ass-sum">
            <span class="summary-title" id="ass-sum-title">My Master Field Assignments: 5 total</span>
          </div>
          <div class="controls" id="ass-ctrl">
            <input class="search-input" id="ass-search" value="Search my tasks..." />
          </div>
          <div class="task-card" id="ass-card">
            <a class="task-title" id="ass-title">What is the legal name of the entity?</a>
            <span class="task-context" id="ass-ctx">• Field 1</span>
            <div class="note-box" id="ass-note">
              <span id="ass-note-txt">Instruction: "Please check registry certificate"</span>
            </div>
          </div>
        </body>
        </html>
        `;
        await page.setContent(ASSIGNMENTS_SURFACE_HTML);

        const tabBg = await page.evaluate(() => getComputedStyle(document.getElementById('ass-tab-act')!).backgroundColor);
        const tabTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('ass-tab-act')!).color);
        const sumBg = await page.evaluate(() => getComputedStyle(document.getElementById('ass-sum')!).backgroundColor);
        const sumTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('ass-sum-title')!).color);
        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('ass-card')!).backgroundColor);
        const titleColor = await page.evaluate(() => getComputedStyle(document.getElementById('ass-title')!).color);
        const ctxColor = await page.evaluate(() => getComputedStyle(document.getElementById('ass-ctx')!).color);
        const noteBg = await page.evaluate(() => getComputedStyle(document.getElementById('ass-note')!).backgroundColor);
        const noteTxtColor = await page.evaluate(() => getComputedStyle(document.getElementById('ass-note-txt')!).color);

        expect(getContrastRatio(tabBg, tabTxtColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(sumBg, sumTxtColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, titleColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, ctxColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(noteBg, noteTxtColor)).toBeGreaterThanOrEqual(4.5);
    });

    test('10. Client Organization Dashboard (/app/clients/[clientId]) Surface in Dark Mode passes WCAG >= 4.5:1 contrast for Client LE title and card subtext', async ({ page }) => {
        const CLIENT_DASHBOARD_SURFACE_HTML = `
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <style>
            .dark {
              --background: #090d16;
              --foreground: #f8fafc;
              --card: #111726;
              --card-foreground: #f8fafc;
              --muted: #1e293b;
              --muted-foreground: #94a3b8;
              --border: #1e293b;
            }
            body { background: var(--background); color: var(--foreground); font-family: sans-serif; padding: 2rem; }
            .section-heading { color: var(--foreground); font-size: 1.25rem; font-weight: 600; }
            .le-card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); padding: 1.25rem; border-radius: 0.5rem; margin-top: 1rem; }
            .le-title { color: var(--foreground); font-size: 1.125rem; font-weight: 600; }
            .le-desc { color: var(--muted-foreground); font-size: 0.875rem; }
            .access-header { color: var(--muted-foreground); font-size: 0.625rem; font-weight: 600; text-transform: uppercase; }
            .user-count { color: var(--foreground); font-size: 0.75rem; font-weight: 600; }
          </style>
        </head>
        <body>
          <h2 class="section-heading" id="cli-sec">Legal Entities</h2>
          <div class="le-card" id="cli-card">
            <h3 class="le-title" id="cli-le-name">Acme UK Operations Ltd</h3>
            <p class="le-desc" id="cli-le-desc">UK primary operating entity for trading activities.</p>
            <span class="access-header" id="cli-acc-hdr">Access</span>
            <span class="user-count" id="cli-usr-cnt">2 users · 1 invited</span>
          </div>
        </body>
        </html>
        `;
        await page.setContent(CLIENT_DASHBOARD_SURFACE_HTML);

        const cardBg = await page.evaluate(() => getComputedStyle(document.getElementById('cli-card')!).backgroundColor);
        const titleColor = await page.evaluate(() => getComputedStyle(document.getElementById('cli-le-name')!).color);
        const descColor = await page.evaluate(() => getComputedStyle(document.getElementById('cli-le-desc')!).color);
        const usrCntColor = await page.evaluate(() => getComputedStyle(document.getElementById('cli-usr-cnt')!).color);

        expect(getContrastRatio(cardBg, titleColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, descColor)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(cardBg, usrCntColor)).toBeGreaterThanOrEqual(4.5);
    });
});
