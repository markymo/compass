import { getQuestionnairesV2 } from "@/actions/questionnaires-v2";
import { QuestionnairesV2Explorer } from "@/components/admin/questionnaires-v2/QuestionnairesV2Explorer";

export const dynamic = "force-dynamic";

export default async function QuestionnairesV2Page({
    searchParams,
}: {
    searchParams: { tab?: string };
}) {
    const tab = searchParams.tab === "reference" ? "reference" : "working-copy";
    const data = await getQuestionnairesV2();

    return <QuestionnairesV2Explorer data={data} initialTab={tab} />;
}
