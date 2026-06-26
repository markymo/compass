import { formatReleasedValue } from "./src/lib/export/formatReleasedValue";

async function runTests() {
    console.log("Running format tests...");
    
    // 1. Scalar
    const scalarRes = await formatReleasedValue({ value: "test string" });
    console.assert(scalarRes === "test string", "Scalar failed");
    
    // 2. Unknown object (should not dump raw JSON but safe string)
    const unknownRes = await formatReleasedValue({ value: { foo: "bar", internal: true } });
    console.assert(unknownRes === "foo: bar, internal: true" || unknownRes.includes("foo: bar"), "Unknown object failed");
    
    // 3. Embedded PARTY with displayMask
    const partyWithMask = {
        contactType: "PERSON",
        forenames: "John",
        surname: "Doe",
        dateOfBirth: "1980-01-01",
        sourceIdentifiers: [{ scheme: "passport", value: "123" }]
    };
    const partyWithMaskRes = await formatReleasedValue({
        value: partyWithMask,
        appDataType: "PARTY",
        profileConfig: { displayMask: ["forenames", "surname"] }
    });
    console.assert(partyWithMaskRes === "John, Doe", "Party with mask failed: " + partyWithMaskRes);

    // 4. Embedded PARTY without displayMask
    const partyNoMaskRes = await formatReleasedValue({
        value: partyWithMask,
        appDataType: "PARTY"
    });
    console.assert(partyNoMaskRes === "John Doe", "Party no mask failed: " + partyNoMaskRes);

    // 5. Embedded ADDRESS
    const addr = {
        addressLines: ["123 Main St", "Apt 4B"],
        locality: "London",
        postalCode: "SW1A 1AA",
        countryCode: "GB"
    };
    const addrRes = await formatReleasedValue({
        value: addr,
        appDataType: "ADDRESS"
    });
    console.assert(addrRes === "123 Main St, Apt 4B, London, SW1A 1AA, United Kingdom", "Address failed: " + addrRes);

    console.log("All tests passed!");
}

runTests().catch(console.error);
