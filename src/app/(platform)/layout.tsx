import { getIdentity } from "@/lib/auth";
import { ensureUserOrg, checkIsSystemAdmin } from "@/actions/client";
import { Badge } from "@/components/ui/badge";
import { PlatformNavbar } from "@/components/layout/PlatformNavbar";
import { Footer } from "@/components/layout/Footer";

export default async function PlatformLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const identity = await getIdentity();
    const userId = identity?.userId;
    let orgName = "";
    let orgTypes: string[] = [];
    let isSystemAdmin = false;

    if (userId) {
        const email = identity?.email || "";

        // Ensure user record exists & sync email
        // We ignore the returned org as we operate in global context
        await ensureUserOrg(userId, email);

        // Check system admin status
        isSystemAdmin = await checkIsSystemAdmin(userId);
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900">
            <PlatformNavbar isSystemAdmin={isSystemAdmin} />
            <main className="flex-1 container mx-auto p-4 md:p-8">
                {children}
            </main>
            <Footer />
        </div>
    );
}
