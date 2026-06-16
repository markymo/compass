import { redirect } from "next/navigation";

interface CCCPageProps {
    params: Promise<{ id: string }>;
}

export default async function CCCPage({ params }: CCCPageProps) {
    const { id } = await params;
    redirect(`/app/le/${id}/sources/ccc`);
}
