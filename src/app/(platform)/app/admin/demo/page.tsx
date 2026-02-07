
import { isSystemAdmin } from "@/actions/security";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DemoUserList } from "./demo-user-list"; // Client Component

export default async function DemoRoomPage() {
    const admin = await isSystemAdmin();
    if (!admin) {
        redirect("/app");
    }

    const demoUsers = await prisma.user.findMany({
        where: { isDemoActor: true },
        include: {
            memberships: {
                include: { organization: true }
            }
        }
    });

    return (
        <div className="space-y-6">
            <div className="border-b bg-amber-50 px-6 py-8">
                <h1 className="text-3xl font-bold tracking-tight text-amber-900 font-sans">
                    Demo Room
                </h1>
                <p className="mt-2 text-amber-800/80">
                    Manage and impersonate demo actors safely. Only accessible by System Administrators.
                </p>
            </div>

            <div className="px-6 py-8 container mx-auto">
                <DemoUserList users={demoUsers} />
            </div>
        </div>
    );
}
