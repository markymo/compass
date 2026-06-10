/**
 * scripts/generate-elf-codes.ts
 *
 * Downloads the official GLEIF ISO 20275 ELF code list (Excel) and generates
 *   src/lib/gleif/elf-codes.ts
 *
 * Usage:
 *   npm run gleif:generate-elf
 *   npm run gleif:generate-elf -- --url https://...custom-version.xlsx
 *
 * The generated file is committed to source control so the runtime has no
 * dependency on GLEIF infrastructure.
 */

// @ts-nocheck
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_URL =
    "https://www.gleif.org/lei-data/code-lists/iso-20275-entity-legal-forms-code-list/2026-02-19-elf-code-list-v1.6.xlsx";

const OUTPUT_FILE = path.resolve(
    __dirname,
    "../src/lib/gleif/elf-codes.ts"
);

// Column indices in the XLSX (0-based, from header row inspection)
const COL_ELF_CODE        = 0;
const COL_COUNTRY_CODE    = 2;  // ISO 3166-1 alpha-2
const COL_LOCAL_NAME      = 5;  // Local language name
const COL_LANGUAGE        = 6;  // Language name
const COL_TRANSLITERATED  = 8;  // English transliteration (ISO 01-140-10)
const COL_ABBREVIATION    = 9;  // Abbreviations (local)
const COL_STATUS          = 12; // ACTV | INAC

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(): { url: string } {
    const args = process.argv.slice(2);
    const urlIdx = args.indexOf("--url");
    return {
        url: urlIdx !== -1 && args[urlIdx + 1] ? args[urlIdx + 1] : (process.env.ELF_XLSX_URL || DEFAULT_URL),
    };
}

function downloadFile(url: string, destPath: string): void {
    console.log(`  Downloading: ${url}`);
    try {
        // curl handles GLEIF's rotating CDN redirects correctly; -L follows all redirects
        execSync(
            `curl -sL --max-time 60 --max-redirs 30 -A "compass-elf-generator/1.0" -o "${destPath}" "${url}"`,
            { stdio: ["ignore", "inherit", "pipe"] }
        );
    } catch (err: any) {
        const msg = err.stderr?.toString() || err.message;
        throw new Error(`curl failed: ${msg}`);
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size < 10_000) {
        throw new Error(
            `Downloaded file is missing or suspiciously small (${fs.existsSync(destPath) ? fs.statSync(destPath).size : 0} bytes). ` +
            `Try providing the URL manually: npm run gleif:generate-elf -- --url <direct-xlsx-url>`
        );
    }
}


function readXlsx(filePath: string): any[][] {
    // Dynamically require xlsx — it's a devDependency
    let xlsx: any;
    try {
        xlsx = require("xlsx");
    } catch {
        console.error("\n❌  Missing dependency: xlsx");
        console.error("   Run: npm install --save-dev xlsx");
        process.exit(1);
    }

    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
}

interface ElfEntry {
    code: string;
    name: string;
    countryCode: string | null;
    abbreviation: string | null;
}

function parseEntries(rows: any[][]): ElfEntry[] {
    // Skip header row (row 0). One ELF code can have multiple language rows.
    // Strategy: for each code, prefer English transliteration, fall back to local name.

    // Group rows by ELF code, keeping only ACTV ones
    const byCode = new Map<string, any[][]>();

    for (const row of rows.slice(1)) {
        const code   = (row[COL_ELF_CODE] ?? "").toString().trim();
        const status = (row[COL_STATUS]   ?? "").toString().trim();
        if (!code || status !== "ACTV") continue;

        const group = byCode.get(code) ?? [];
        group.push(row);
        byCode.set(code, group);
    }

    const entries: ElfEntry[] = [];

    for (const [code, rows] of byCode) {
        const countryCode = rows[0][COL_COUNTRY_CODE] ?? null;

        // Pick best name: prefer English transliteration row
        const englishRow = rows.find(
            r => (r[COL_LANGUAGE] ?? "").toString().toLowerCase().includes("english")
        );
        const primaryRow = englishRow ?? rows[0];

        // Transliterated name is the most useful for display (Latin script)
        const transliterated = (primaryRow[COL_TRANSLITERATED] ?? "").toString().trim();
        const localName      = (primaryRow[COL_LOCAL_NAME]     ?? "").toString().trim();
        const name           = transliterated || localName || null;

        const rawAbbrev = (primaryRow[COL_ABBREVIATION] ?? "").toString().trim();
        const abbreviation = rawAbbrev || null;

        if (name) {
            entries.push({ code, name, countryCode, abbreviation });
        }
    }

    // Sort by ELF code for deterministic output
    entries.sort((a, b) => a.code.localeCompare(b.code));
    return entries;
}

function generateTypeScript(entries: ElfEntry[], sourceUrl: string, generatedAt: string): string {
    const mapLines = entries.map(e => {
        const safeName    = e.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const safeAbbrev  = e.abbreviation?.replace(/\\/g, "\\\\").replace(/"/g, '\\"') ?? null;
        const countryPart = e.countryCode ? `countryCode: ${JSON.stringify(e.countryCode)}` : `countryCode: undefined`;
        const abbrevPart  = safeAbbrev ? `, abbreviation: "${safeAbbrev}"` : "";
        return `    "${e.code}": { name: "${safeName}", ${countryPart}${abbrevPart} },`;
    });

    return `/**
 * ⚠️  AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
 *
 * Generated from the official GLEIF ISO 20275 Entity Legal Forms (ELF) code list.
 * Source: ${sourceUrl}
 * Generated: ${generatedAt}
 * Total active codes: ${entries.length}
 *
 * To regenerate, run:
 *   npm run gleif:generate-elf
 *
 * Optionally pass a custom URL:
 *   npm run gleif:generate-elf -- --url <xlsx-url>
 *   ELF_XLSX_URL=<xlsx-url> npm run gleif:generate-elf
 */

export interface ElfResolution {
    id: string;
    name: string | null;
    countryCode?: string;
    abbreviation?: string;
}

const ELF_MAP: Record<string, { name: string; countryCode?: string; abbreviation?: string }> = {
${mapLines.join("\n")}
};

/**
 * Resolves an ELF code to its human-readable legal form name.
 * Returns { id, name: null } for unknown codes — never throws.
 */
export function resolveElfCode(elfId: string | null | undefined): ElfResolution {
    if (!elfId) return { id: "", name: null };
    const entry = ELF_MAP[elfId];
    if (!entry) return { id: elfId, name: null };
    return {
        id: elfId,
        name: entry.name,
        countryCode: entry.countryCode,
        abbreviation: entry.abbreviation,
    };
}
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const { url } = parseArgs();
    const tmpFile = path.join(require("os").tmpdir(), `gleif-elf-${Date.now()}.xlsx`);

    console.log("\n🔄  GLEIF ELF Code Generator\n");

    try {
        // 1. Download
        downloadFile(url, tmpFile);
        console.log(`  ✓  Downloaded (${Math.round(fs.statSync(tmpFile).size / 1024)} KB)`);

        // 2. Parse
        console.log("  Parsing XLSX...");
        const rows    = readXlsx(tmpFile);
        const entries = parseEntries(rows);
        console.log(`  ✓  Parsed ${entries.length} active ELF codes from ${rows.length - 1} rows`);

        // 3. Generate
        const ts = generateTypeScript(entries, url, new Date().toISOString().split("T")[0]);
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, ts, "utf8");
        console.log(`  ✓  Written to ${path.relative(process.cwd(), OUTPUT_FILE)}`);

        // 4. Verify
        console.log("  Verifying resolveElfCode on a sample code...");
        // Quick sanity: H0PO should be in the file for GB
        if (!ts.includes('"H0PO"')) {
            console.warn("  ⚠️  H0PO (UK Private Limited Company) not found — check source file");
        } else {
            console.log("  ✓  H0PO present (UK Private Limited Company)");
        }

        console.log(`\n✔  Done. ${entries.length} active codes written.\n`);

    } finally {
        fs.rmSync(tmpFile, { force: true });
    }
}

main().catch(err => {
    console.error("\n❌  Generator failed:", err.message);
    process.exit(1);
});
