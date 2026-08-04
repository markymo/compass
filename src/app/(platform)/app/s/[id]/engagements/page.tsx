import { redirect } from "next/navigation";

export default async function FIEngagementsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return redirect(`/app/s/${id}`);
}
