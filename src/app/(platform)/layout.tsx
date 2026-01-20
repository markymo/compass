import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ensureUserOrg, getUserOrganizations } from "@/actions/client";
import { Badge } from "@/components/ui/badge";
import { PlatformNavbar } from "@/components/layout/PlatformNavbar";
import { Footer } from "@/components/layout/Footer";

export default async function PlatformLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId, sessionClaims } = await auth();
    let orgName = "";
    let orgTypes: string[] = [];
    let availableOrgs: any[] = []; // Pass to Navbar

    if (userId) {
        const email = (sessionClaims?.email as string) || "";
        // Fetch or create the org context
        const org = await ensureUserOrg(userId, email);
        if (org) {
            orgName = org.name;
            orgTypes = org.types;
        }

        // Fetch all avail orgs for switcher
        availableOrgs = await getUserOrganizations();
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900">
            <PlatformNavbar orgName={orgName} orgTypes={orgTypes} availableOrgs={availableOrgs} />
            <main className="flex-1 container mx-auto p-4 md:p-8">
                {children}
            </main>
            <Footer />
        </div>
    );
}
