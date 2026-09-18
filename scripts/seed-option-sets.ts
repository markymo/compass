/**
 * seed-option-sets.ts
 *
 * Bulk-insert / upsert MasterDataOptionSet records directly into Neon via Prisma.
 *
 * Usage:
 *   # Seed all option sets:
 *   npm run db:seed:option-sets
 *
 *   # Targeted seed for a single option set:
 *   npm run db:seed:option-sets -- ISO_Currency_Code
 *   # or:
 *   npx ts-node -O '{"module":"commonjs"}' scripts/seed-option-sets.ts ISO_Currency_Code
 *
 * Behaviour:
 *   - Each entry below is upserted by `name` (unique key).
 *   - If the name already exists the options array is REPLACED.
 *   - If the name does not exist a new row is created.
 *   - Run this as many times as you like — it is idempotent.
 *
 * Options array format:
 *   { label: "Display Text shown to users", value: "RAW_VALUE_stored_in_DB" }
 *
 *   - label  → what the user sees in a dropdown
 *   - value  → what gets stored in the claim / answer (keep stable, don't rename)
 *   - Order  → array order = dropdown order, so sort them how you want them displayed
 */

// @ts-nocheck
import { PrismaClient } from "@prisma/client";
import isoCurrencies from "./iso-currencies.json";
import gleifLegalJurisdictions from "./gleif-legal-jurisdictions.json";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
//  ADD / EDIT YOUR OPTION SETS HERE
// ─────────────────────────────────────────────────────────────────────────────

export const OPTION_SETS: Array<{
    name: string;
    description?: string;
    valueType: "STRING" | "NUMBER" | "BOOLEAN";
    options: Array<{ label: string; value: string | number | boolean }>;
}> = [

    // ── ISO 4217 Currencies (ONP-190) ─────────────────────────────────────────
    {
        name: "ISO_Currency_Code",
        description: "ISO 4217:2015 3 letter currency code (https://www.six-group.com/en/products-services/financial-information/data-standards.html)",
        valueType: "STRING",
        options: isoCurrencies,
    },

    // ── GLEIF Accepted Legal Jurisdictions (ONP-203) ──────────────────────────
    {
        name: "GLEIF_Legal_Jurisdictions",
        description: "GLEIF Accepted Legal Jurisdictions Code List — Version 1.5 (https://www.gleif.org/en/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list)",
        valueType: "STRING",
        options: gleifLegalJurisdictions,
    },

    // ── Example: Legal Entity Types ──────────────────────────────────────────
    {
        name: "Legal_Entity_Types",
        description: "Standard legal entity / company structure types",
        valueType: "STRING",
        options: [
            { label: "Private Limited Company",            value: "PRIVATE_LIMITED" },
            { label: "Public Limited Company",             value: "PUBLIC_LIMITED" },
            { label: "Limited Liability Partnership",      value: "LLP" },
            { label: "General Partnership",                value: "GENERAL_PARTNERSHIP" },
            { label: "Sole Trader",                        value: "SOLE_TRADER" },
            { label: "Charitable Incorporated Organisation", value: "CIO" },
            { label: "Trust",                              value: "TRUST" },
            { label: "Foundation",                         value: "FOUNDATION" },
            { label: "Branch",                             value: "BRANCH" },
            { label: "Other",                              value: "OTHER" },
        ],
    },

    // ── Example: Countries (ISO 3166-1 alpha-2) ───────────────────────────────
    // Add as many as you need. Tip: paste from a spreadsheet, then find+replace
    // to get it into { label: "...", value: "..." } format.
    {
        name: "ISO_Country_Codes",
        description: "ISO 3166-1 alpha-2 country codes",
        valueType: "STRING",
        options: [
            { label: "United Kingdom",  value: "GB" },
            { label: "United States",   value: "US" },
            { label: "Germany",         value: "DE" },
            { label: "France",          value: "FR" },
            { label: "Netherlands",     value: "NL" },
            { label: "Ireland",         value: "IE" },
            { label: "Luxembourg",      value: "LU" },
            { label: "Switzerland",     value: "CH" },
            { label: "Singapore",       value: "SG" },
            { label: "Cayman Islands",  value: "KY" },
            // … add more rows here …
        ],
    },

    // ── Example: Jurisdictions (if different from country) ────────────────────
    {
        name: "Jurisdictions",
        description: "Regulatory / legal jurisdictions",
        valueType: "STRING",
        options: [
            { label: "England & Wales",     value: "ENG_WALES" },
            { label: "Scotland",            value: "SCOTLAND" },
            { label: "Northern Ireland",    value: "N_IRELAND" },
            { label: "Delaware (US)",       value: "US_DE" },
            { label: "New York (US)",       value: "US_NY" },
            { label: "Cayman Islands",      value: "KY" },
            { label: "British Virgin Islands", value: "BVI" },
            { label: "Luxembourg",          value: "LU" },
            { label: "Ireland",             value: "IE" },
            { label: "Singapore",           value: "SG" },
        ],
    },

    // ── Example: Keep existing Example_Industries (will overwrite with corrected label/value swap) ─
    // NOTE: In the existing DB the label/value appear to be swapped. This corrects them.
    {
        name: "Example_Industries",
        description: "Industry classification options (example)",
        valueType: "STRING",
        options: [
            { label: "Agriculture",             value: "AGRICULTURE" },
            { label: "Chemicals & Materials",   value: "CHEMICALS" },
            { label: "Defence",                 value: "DEFENCE" },
            { label: "Energy",                  value: "ENERGY" },
            { label: "Financial Services",      value: "FINANCIAL_SERVICES" },
            { label: "Healthcare",              value: "HEALTHCARE" },
            { label: "Infrastructure",          value: "INFRASTRUCTURE" },
            { label: "Real Estate",             value: "REAL_ESTATE" },
            { label: "Technology",              value: "TECHNOLOGY" },
            { label: "Telecommunications",      value: "TELECOMS" },
        ],
    },

];

// ─────────────────────────────────────────────────────────────────────────────
//  Runner — supports seeding all or a single targeted option set
// ─────────────────────────────────────────────────────────────────────────────

export async function main(targetName?: string) {
    const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
    let requested = targetName || args[0];

    // Backwards-compatible alias for previous Option Set name
    if (requested === "ISO_Legal_Jurisdictions") {
        requested = "GLEIF_Legal_Jurisdictions";
    }

    const setsToSeed = requested
        ? OPTION_SETS.filter((s) => s.name === requested)
        : OPTION_SETS;

    if (requested && setsToSeed.length === 0) {
        console.error(`\n❌  No option set found matching: "${requested}"`);
        console.error(`Available option sets: ${OPTION_SETS.map((s) => s.name).join(", ")}\n`);
        process.exit(1);
    }

    console.log(`\n🌱  Seeding ${setsToSeed.length} option set(s) into Neon…\n`);

    const STABLE_IDS: Record<string, string> = {
        GLEIF_Legal_Jurisdictions: "192aa8b1-a1bd-4e69-b50c-a9f06f61cf53",
    };
    const PREVIOUS_NAMES: Record<string, string> = {
        GLEIF_Legal_Jurisdictions: "ISO_Legal_Jurisdictions",
    };

    for (const set of setsToSeed) {
        const stableId = STABLE_IDS[set.name];
        const prevName = PREVIOUS_NAMES[set.name];
        let existing = null;

        if (stableId) {
            existing = await prisma.masterDataOptionSet.findUnique({
                where: { id: stableId },
                select: { id: true, name: true },
            });
        }
        if (!existing && prevName) {
            existing = await prisma.masterDataOptionSet.findUnique({
                where: { name: prevName },
                select: { id: true, name: true },
            });
        }
        if (!existing) {
            existing = await prisma.masterDataOptionSet.findUnique({
                where: { name: set.name },
                select: { id: true, name: true },
            });
        }

        let optionSetId: string;
        if (existing) {
            await prisma.masterDataOptionSet.update({
                where: { id: existing.id },
                data: {
                    name:        set.name,
                    description: set.description,
                    valueType:   set.valueType,
                    options:     set.options as any,
                    updatedAt:   new Date(),
                },
            });
            optionSetId = existing.id;
            console.log(`  ✏️  Updated  "${set.name}" [${optionSetId}] (${set.options.length} options)`);
        } else {
            const created = await prisma.masterDataOptionSet.create({
                data: {
                    id:          stableId || undefined,
                    name:        set.name,
                    description: set.description,
                    valueType:   set.valueType,
                    options:     set.options as any,
                    isActive:    true,
                },
            });
            optionSetId = created.id;
            console.log(`  ✅  Created  "${set.name}" [${optionSetId}] (${set.options.length} options)`);
        }

        // Special link-up for GLEIF_Legal_Jurisdictions (ONP-203):
        // Ensure F134, F143, F156, F157 are associated with this Option Set ID
        if (set.name === "GLEIF_Legal_Jurisdictions") {
            // Declaratively associate F134 (Country of formation) for display lookup while keeping appDataType: TEXT
            await prisma.masterFieldDefinition.updateMany({
                where: { fieldNo: 134, isActive: true },
                data: { optionSetId },
            });
            // Ensure F143, F156, F157 continue pointing to this Option Set ID
            await prisma.masterFieldDefinition.updateMany({
                where: { fieldNo: { in: [143, 156, 157] }, isActive: true },
                data: { optionSetId },
            });
            console.log(`  🔗  Linked F134, F143, F156, F157 to "${set.name}" [${optionSetId}]`);
        }
    }

    console.log("\n✔  Done.\n");
}

if (require.main === module) {
    main()
        .catch((e) => {
            console.error("❌  Seed failed:", e);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
