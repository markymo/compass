
// Validates an LEI string (format only)
function isValidLEIFormat(lei: string): boolean {
    return /^[A-Z0-9]{20}$/.test(lei);
}

// Minimal fetcher for testing in Node
async function fetchGLEIFData(lei: string) {
    const cleanLEI = lei.trim().toUpperCase();

    console.log(`Fetching data for LEI: ${cleanLEI}`);

    if (!isValidLEIFormat(cleanLEI)) {
        console.error("Invalid LEI format.");
        return;
    }

    try {
        const response = await fetch(`https://api.gleif.org/api/v1/lei-records?filter[lei]=${cleanLEI}`, {
            headers: {
                'Accept': 'application/vnd.api+json'
            }
        });

        if (!response.ok) {
            console.error(`Status: ${response.status} ${response.statusText}`);
            return;
        }

        const json = await response.json();
        console.log("Response JSON (truncated):", JSON.stringify(json).substring(0, 200) + "...");

        if (!json.data || json.data.length === 0) {
            console.log("No records found.");
            return;
        }

        const record = json.data[0];
        const attributes = record.attributes;
        const entity = attributes.entity;

        const summary = {
            name: entity.legalName.name,
            jurisdiction: entity.jurisdiction,
            address: `${entity.legalAddress.addressLines.join(", ")}, ${entity.legalAddress.city}, ${entity.legalAddress.country}`,
            status: attributes.registration.status // e.g. ISSUED, LAPSED
        };

        console.log("\n--- Summary ---");
        console.log(JSON.stringify(summary, null, 2));
        console.log("\n--- Initial Registration Date ---");
        console.log(attributes.registration.initialRegistrationDate);

    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

// Test with Google's LEI
fetchGLEIFData("5493006MHB84DD0ZWV18");
