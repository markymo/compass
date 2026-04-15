import { OfficialGermanRegistryConnector } from "./src/domain/registry/connectors/OfficialGermanRegistryConnector";

async function run() {
    const connector = new OfficialGermanRegistryConnector();
    try {
        const result = await connector.fetch({
            localRegistrationNumber: "HRB 130853",
            registryAuthorityId: "RA000242",
        } as any);
        console.log("Success:", result);
    } catch (e: any) {
        console.error("Failed:", e.message);
    }
}
run();
