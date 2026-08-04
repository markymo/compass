import { redirect } from "next/navigation";

export default async function FISettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return redirect(`/app/s/${id}`);
}
