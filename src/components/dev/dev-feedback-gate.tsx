import { headers } from "next/headers";
import dynamic from "next/dynamic";

const FeedbackWidget = dynamic(
    () => import("@/components/dev/feedback-widget").then((mod) => mod.FeedbackWidget),
    { ssr: false }
);

const ALLOWED_HOSTS = ["localhost", "dev.onpro.tech", "onpro.tech"];

export async function DevFeedbackGate() {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const hostname = host.split(":")[0]; // strip port number

    const isAllowed = ALLOWED_HOSTS.some((h: any) => hostname === h || hostname.endsWith(`.${h}`));

    if (!isAllowed) return null;

    return <FeedbackWidget />;
}

