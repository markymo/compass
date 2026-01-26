
import { UserPermissionEditor } from "@/components/super-admin/UserPermissionEditor";
import { getUserPermissionsProfile } from "@/actions/super-admin-users";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const profile = await getUserPermissionsProfile(id);

    if (!profile) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <h2 className="text-xl font-semibold">User Not Found</h2>
                <p>The user with ID {id} could not be found.</p>
                <Button variant="link" asChild className="mt-4">
                    <Link href="/app/admin/users">Back to Users</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto py-8 px-6">
            <div className="mb-6">
                <Button variant="ghost" size="sm" asChild className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                    <Link href="/app/admin/users">
                        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Users
                    </Link>
                </Button>
            </div>

            <UserPermissionEditor profile={profile} userId={id} />
        </div>
    );
}
