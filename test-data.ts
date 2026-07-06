import { getClientLEData } from "./src/actions/client";

async function main() {
    const data = await getClientLEData("3f3b592b-20e3-46c8-9eb1-9af01958f99f");
    console.log("commonQuestionnaires length:", data?.le?.commonQuestionnaires?.length);
    if (data?.le?.commonQuestionnaires?.length) {
        console.log("Common Qs:", data.le.commonQuestionnaires.map(q => q.name));
    }
}
main().catch(console.error);
