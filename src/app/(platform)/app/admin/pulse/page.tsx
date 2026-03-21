import { getPulseData } from "@/actions/pulse";
import { getIdentity } from "@/lib/auth";
import { checkIsSystemAdmin } from "@/actions/client";
import { redirect } from "next/navigation";
import { PulseClient } from "./client";

export default async function PulsePage() {
    const identity = await getIdentity();
    if (!identity?.userId) redirect("/login");

    const isSysAdmin = await checkIsSystemAdmin(identity.userId);
    if (!isSysAdmin) redirect("/app");

    // Default: production only, last 30 days
    const result = await getPulseData({ days: 30, includeAllEnvs: false });

    if (!result.success || !result.data) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900">Pulse</h1>
                <p className="text-red-500">Failed to load pulse data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900">Pulse</h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Platform activity at a glance — {result.data.summary.period}
                    </p>
                </div>
            </div>

            <PulseClient data={result.data} />
        </div>
    );
}
