import { getMomentumReadiness } from "@/actions/momentum";
import { MomentumDashboard } from "@/components/client/admin/momentum/momentum-dashboard";

/**
 * Momentum Page (Slice: Interactivity)
 * Connects the dashboard to the field editing experience.
 */
export default async function MomentumPage() {
    const data = await getMomentumReadiness();

    return <MomentumDashboard data={data} />;
}
