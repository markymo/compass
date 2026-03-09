import prisma from "../lib/prisma";
import { refreshLocalRegistryData } from "../actions/registry";

async function main() {
    const leId = 'b8bfc0b8-c3cf-4ff6-81e5-98429f7cd49e';
    console.log("--- REPRO START ---");
    try {
        const result = await refreshLocalRegistryData(leId);
        console.log("--- REPRO RESULT ---");
        console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("--- REPRO CRASHED ---");
        console.error(error);
    }
}

main().catch(console.error);
