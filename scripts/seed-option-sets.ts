/**
 * seed-option-sets.ts
 *
 * Bulk-insert / upsert MasterDataOptionSet records directly into Neon via Prisma.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-option-sets.ts
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

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
//  ADD / EDIT YOUR OPTION SETS HERE
// ─────────────────────────────────────────────────────────────────────────────

const OPTION_SETS: Array<{
    name: string;
    description?: string;
    valueType: "STRING" | "NUMBER" | "BOOLEAN";
    options: Array<{ label: string; value: string | number | boolean }>;
}> = [

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

    // ── Paste your next set below this line ───────────────────────────────────
    // {
    //     name: "My_New_Set",
    //     description: "...",
    //     valueType: "STRING",
    //     options: [
    //         { label: "Display Label", value: "RAW_VALUE" },
    //     ],
    // },

];

// ─────────────────────────────────────────────────────────────────────────────
//  Runner — no need to edit below this line
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🌱  Seeding ${OPTION_SETS.length} option set(s) into Neon…\n`);

    for (const set of OPTION_SETS) {
        const existing = await prisma.masterDataOptionSet.findUnique({
            where: { name: set.name },
            select: { id: true, name: true },
        });

        if (existing) {
            await prisma.masterDataOptionSet.update({
                where: { id: existing.id },
                data: {
                    description: set.description,
                    valueType:   set.valueType,
                    options:     set.options as any,
                    updatedAt:   new Date(),
                },
            });
            console.log(`  ✏️  Updated  "${set.name}"  (${set.options.length} options)`);
        } else {
            await prisma.masterDataOptionSet.create({
                data: {
                    name:        set.name,
                    description: set.description,
                    valueType:   set.valueType,
                    options:     set.options as any,
                    isActive:    true,
                },
            });
            console.log(`  ✅  Created  "${set.name}"  (${set.options.length} options)`);
        }
    }

    console.log("\n✔  Done.\n");
}

main()
    .catch((e) => {
        console.error("❌  Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
