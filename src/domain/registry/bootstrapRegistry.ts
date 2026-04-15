import prisma from "@/lib/prisma";

/**
 * Bootstraps initial registry authority data.
 * This identifies RAIDs from GLEIF (e.g. RA000585) and maps them to internal connectors.
 */
export async function bootstrapRegistryAuthorities() {
    console.log("[Bootstrap] Seeding registry authorities...");
    
    const initialAuthorities = [
        {
            id: "RA000585",
            registryKey: "GB_COMPANIES_HOUSE",
            name: "Companies House",
            countryCode: "GB",
            jurisdiction: "UK",
            lookupStrategy: "LOCAL_ID",
            notes: "UK national registry for companies"
        },
        {
            id: "RA000242",
            registryKey: "DE_HANDELSREGISTER",
            name: "Gemeinsames Registerportal der Länder (Frankfurt am Main)",
            countryCode: "DE",
            jurisdiction: "DE",
            lookupStrategy: "LOCAL_ID",
            notes: "German national registry portal"
        },
        // Future extensions:
        // { id: "RA000431", registryKey: "NL_KVK", name: "Kamer van Koophandel", countryCode: "NL" }
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
