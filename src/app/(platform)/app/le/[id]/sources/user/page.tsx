import { redirect } from "next/navigation";

interface UserPageProps {
    params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
    const { id } = await params;
    redirect(`/app/le/${id}/sources/user/parties`);
}
