import { getQuestionnairesV2 } from "@/actions/questionnaires-v2";
import { QuestionnairesV2Explorer } from "@/components/admin/questionnaires-v2/QuestionnairesV2Explorer";

export const dynamic = "force-dynamic";

export default async function QuestionnairesV2Page({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const sp = await searchParams;
    const tab = sp.tab === "reference" ? "reference" : sp.tab === "other" ? "other" : "working-copy";
    const data = await getQuestionnairesV2();

    return <QuestionnairesV2Explorer data={data} initialTab={tab} />;
}
