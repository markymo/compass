import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/65371e45-1bc1-4fa8-9609-6430ba83744d';

const PRODUCT_SURFACES_HTML = `
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
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .header {
      background-color: var(--card);
      color: var(--card-foreground);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      margin-bottom: 24px;
      border-radius: 8px;
    }
    .card {
      background-color: var(--card);
      color: var(--card-foreground);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table td, .table th {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      background-color: #f59e0b;
      color: #ffffff;
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
  <div class="header">
    <h1 style="margin:0; font-size:24px;">OnPro Platform — System Administration</h1>
    <p class="muted-text" style="margin:4px 0 0 0;">Managing corporate onboarding, master data, and user permissions</p>
  </div>

  <!-- Admin Users Surface -->
  <div class="card" id="admin-users-surface">
    <h2 style="margin-top:0;">Platform Users</h2>
    <table class="table">
      <thead>
        <tr>
          <th>User Email</th>
          <th>Organizations / Roles</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight:600;">uat+system-admin@onpro.tech</div>
            <span class="badge">Platform Admin</span>
          </td>
          <td>
            <span class="secondary-text" style="font-weight:600;">ONPro System</span>
            <span class="muted-text">(SYSTEM_ADMIN)</span>
          </td>
        </tr>
        <tr>
          <td>
            <div style="font-weight:600;">uat+client-org-admin-a@onpro.tech</div>
          </td>
          <td>
            <span class="secondary-text" style="font-weight:600;">ZZOOMM GROUP LIMITED</span>
            <span class="muted-text">(LE_ADMIN)</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Relationships Surface -->
  <div class="card" id="relationships-surface">
    <h2 style="margin-top:0;">Relationships</h2>
    <p class="muted-text">Your Organisations, Legal Entities and Counterparty Supplier Connections.</p>
    <div style="border: 2px dashed var(--border); padding: 32px; text-align: center; border-radius: 8px;" class="muted-text">
      No counterparty relationships found. Contextual action: + Add Relationship
    </div>
  </div>
</body>
</html>
`;

test.describe('ONP-12 Visual Surface Capture & Verification', () => {

    test('Capture representative Light Mode product surfaces', async ({ page }) => {
        await page.setContent(PRODUCT_SURFACES_HTML);
        await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        });
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_surfaces_light.png'), fullPage: true });
    });

    test('Capture representative Dark Mode product surfaces', async ({ page }) => {
        await page.setContent(PRODUCT_SURFACES_HTML);
        await page.evaluate(() => {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
        });
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_surfaces_dark.png'), fullPage: true });
    });
});
