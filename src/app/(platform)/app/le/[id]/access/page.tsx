import { LEUsersTab } from "@/components/client/le-users-tab";

export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <LEUsersTab leId={id} />
    );
}
