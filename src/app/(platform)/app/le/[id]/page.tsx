import { redirect } from "next/navigation";

export default async function LEDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/app/le/${id}/master`);
}
