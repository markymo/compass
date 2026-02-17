import { applyManualOverride } from "@/actions/kyc-manual-update";

async function run() {
    console.log("Testing applyManualOverride with '0'...");
    try {
        // We use a dummy ID. 
        // Expected outcome: 
        // - If fix works: It routes to updateCustomFieldManually(..., "0", ...) which fails with "LE not found" or DB error.
        // - If fix fails: It routes to updateFieldManually(..., 0, ...) which fails with "Unknown Field No: 0"
        const result = await applyManualOverride("dummy-le-id", "0", "test value", "test reason");
        console.log("Result:", result);
    } catch (e: any) {
        console.error("Caught error:", e.message);
        if (e.message.includes("Unknown Field No")) {
            console.error("FAIL: Still trying to look up Field 0");
            process.exit(1);
        }
    }
}

run();
