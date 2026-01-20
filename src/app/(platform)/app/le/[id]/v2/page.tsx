import { redirect } from "next/navigation";

export default async function LEDashboardV2Redirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/app/le/${id}`);
}
