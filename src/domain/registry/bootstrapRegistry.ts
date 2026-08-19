import prisma from "@/lib/prisma";

/**
 * Bootstraps initial registry authority data.
 * Maps physical RA codes from GLEIF (e.g. RA000585, RA000586, RA000587) to internal connectors and mapping families.
 */
export async function bootstrapRegistryAuthorities() {
    console.log("[Bootstrap] Seeding registry authorities...");
    
    const initialAuthorities = [
        {
            id: "RA000585",
            registryKey: "GB_COMPANIES_HOUSE",
            mappingSourceKey: "COMPANIES_HOUSE",
            name: "United Kingdom of Great Britain and Northern Ireland | Companies House | Companies Register (England and Wales)",
            countryCode: "GB",
            jurisdiction: "England and Wales",
            lookupStrategy: "LOCAL_ID",
            notes: "UK Companies House for England and Wales"
        },
        {
            id: "RA000586",
            registryKey: "GB_COMPANIES_HOUSE",
            mappingSourceKey: "COMPANIES_HOUSE",
            name: "United Kingdom of Great Britain and Northern Ireland | Companies House | Companies Register (Northern Ireland)",
            countryCode: "GB",
            jurisdiction: "Northern Ireland",
            lookupStrategy: "LOCAL_ID",
            notes: "UK Companies House for Northern Ireland"
        },
        {
            id: "RA000587",
            registryKey: "GB_COMPANIES_HOUSE",
            mappingSourceKey: "COMPANIES_HOUSE",
            name: "United Kingdom of Great Britain and Northern Ireland | Companies House | Companies Register (Scotland)",
            countryCode: "GB",
            jurisdiction: "Scotland",
            lookupStrategy: "LOCAL_ID",
            notes: "UK Companies House for Scotland"
        },
        {
            id: "RA000592",
            registryKey: "UK_FCA",
            mappingSourceKey: null,
            name: "United Kingdom of Great Britain and Northern Ireland | Financial Conduct Authority | Financial Services Register",
            countryCode: "GB",
            jurisdiction: "United Kingdom of Great Britain and Northern Ireland",
            lookupStrategy: "LOCAL_ID",
            notes: "UK Financial Conduct Authority (FCA)"
        },
        {
            id: "RA000242",
            registryKey: "DE_HANDELSREGISTER",
            mappingSourceKey: null,
            name: "Gemeinsames Registerportal der Länder (Frankfurt am Main)",
            countryCode: "DE",
            jurisdiction: "DE",
            lookupStrategy: "LOCAL_ID",
            notes: "German national registry portal"
        },
    ];

    for (const auth of initialAuthorities) {
        await prisma.registryAuthority.upsert({
            where: { id: auth.id },
            update: auth,
            create: auth
        });
    }

    console.log(`[Bootstrap] Seeded ${initialAuthorities.length} authorities.`);
}
