/**
 * scripts/generate-gleif-jurisdictions.ts
 *
 * Downloads and parses the official GLEIF Accepted Legal Jurisdictions Code List v1.5 (CSV)
 * and generates `scripts/gleif-legal-jurisdictions.json`.
 *
 * Usage:
 *   npx ts-node -O '{"module":"commonjs"}' scripts/generate-gleif-jurisdictions.ts
 *   # or specify a local file:
 *   npx ts-node -O '{"module":"commonjs"}' scripts/generate-gleif-jurisdictions.ts --file path/to/gleif.csv
 *
 * The generated file is committed to source control so the runtime has no
 * dependency on GLEIF infrastructure.
 */

// @ts-nocheck
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DEFAULT_URL =
    "https://www.gleif.org/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list/gleif_acceptedjurisdictions_v1.5.csv";

const OUTPUT_FILE = path.resolve(
    __dirname,
    "gleif-legal-jurisdictions.json"
);

export interface GleifJurisdictionOption {
    value: string;
    label: string;
}

export function parseCsvContent(csvContent: string): GleifJurisdictionOption[] {
    // 1. Strip UTF-8 BOM if present
    const cleanContent = csvContent.replace(/^\uFEFF/, "").trim();
    const lines = cleanContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length === 0) {
        throw new Error("CSV content is empty");
    }

    // First line is header: "Jurisdiction","Code","Type"
    const header = lines[0];
    if (!header.includes("Jurisdiction") || !header.includes("Code")) {
        throw new Error(`Unexpected CSV header: ${header}`);
    }

    const seenCodes = new Set<string>();
    const options: GleifJurisdictionOption[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple and robust CSV line parser for quoted strings: "col1","col2","col3"
        // Regex matches each quoted segment or unquoted token
        const matches = [...line.matchAll(/"([^"]*)"|([^,]+)/g)].map(m => m[1] ?? m[2] ?? "");
        if (matches.length < 2) {
            throw new Error(`Line ${i + 1} does not have at least 2 columns: ${line}`);
        }

        const jurisdiction = matches[0].trim();
        const code = matches[1].trim();

        if (!code) {
            throw new Error(`Line ${i + 1} has empty code: ${line}`);
        }
        if (!jurisdiction) {
            throw new Error(`Line ${i + 1} has empty jurisdiction: ${line}`);
        }

        if (seenCodes.has(code)) {
            throw new Error(`Duplicate code detected on line ${i + 1}: ${code}`);
        }
        seenCodes.add(code);

        // ONP-190 separator convention: Unicode EN DASH (\u2013) surrounded by spaces
        const label = `${code} \u2013 ${jurisdiction}`;

        options.push({
            value: code,
            label,
        });
    }

    // Stable deterministic ordering: alphabetical by code localeCompare
    options.sort((a, b) => a.value.localeCompare(b.value));

    return options;
}

function downloadFile(url: string, destPath: string): void {
    console.log(`  Downloading: ${url}`);
    try {
        execSync(
            `curl -sL --max-time 60 --max-redirs 30 -A "compass-gleif-generator/1.0" -o "${destPath}" "${url}"`,
            { stdio: ["ignore", "inherit", "pipe"] }
        );
    } catch (err: any) {
        const msg = err.stderr?.toString() || err.message;
        throw new Error(`curl failed: ${msg}`);
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size < 1_000) {
        throw new Error(
            `Downloaded file is missing or suspiciously small (${fs.existsSync(destPath) ? fs.statSync(destPath).size : 0} bytes).`
        );
    }
}

export function generateJurisdictions(inputFile?: string): GleifJurisdictionOption[] {
    let csvContent: string;

    if (inputFile && fs.existsSync(inputFile)) {
        console.log(`  Reading local CSV: ${inputFile}`);
        csvContent = fs.readFileSync(inputFile, "utf8");
    } else {
        const tempCsvPath = path.resolve(__dirname, "temp-gleif-jurisdictions.csv");
        try {
            downloadFile(DEFAULT_URL, tempCsvPath);
            csvContent = fs.readFileSync(tempCsvPath, "utf8");
        } finally {
            if (fs.existsSync(tempCsvPath)) {
                fs.unlinkSync(tempCsvPath);
            }
        }
    }

    const options = parseCsvContent(csvContent);
    console.log(`  Parsed ${options.length} valid jurisdictions.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(options, null, 2) + "\n", "utf8");
    console.log(`  Wrote output to: ${OUTPUT_FILE}`);

    return options;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const fileIdx = args.indexOf("--file");
    const inputFile = fileIdx !== -1 && args[fileIdx + 1] ? args[fileIdx + 1] : undefined;

    try {
        generateJurisdictions(inputFile);
        console.log("✔ Done generating GLEIF legal jurisdictions.\n");
    } catch (err) {
        console.error("❌ Generator failed:", err);
        process.exit(1);
    }
}
