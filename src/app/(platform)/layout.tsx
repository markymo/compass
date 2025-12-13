import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ensureUserOrg } from "@/actions/client";
import { Badge } from "@/components/ui/badge";

export default async function PlatformLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId, sessionClaims } = await auth();
    let orgName = "";
    let orgType = "";

    if (userId) {
        const email = (sessionClaims?.email as string) || "";
        // Fetch or create the org context
        const org = await ensureUserOrg(userId, email);
        if (org) {
            orgName = org.name;
            orgType = org.type;
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <header className="border-b bg-card px-6 py-3 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="font-semibold text-lg">Compass Platform</div>
                    <nav className="text-sm text-muted-foreground space-x-6 flex items-center ml-4">
                        <a href="/app" className="hover:text-foreground font-medium transition-colors">Dashboard</a>
                        {/* TODO: Role based visibility */}
                        {orgType === "CLIENT" && (
                            <a href="/app/client" className="hover:text-foreground font-medium transition-colors">Client Area</a>
                        )}
                        {orgType === "FI" && (
                            <a href="/app/fi" className="hover:text-foreground font-medium transition-colors">FI Area</a>
                        )}
                        {/* System Admin Link - For now visible to all until we have strict System Admin checks */}
                        <a href="/app/admin" className="hover:text-foreground font-medium transition-colors text-amber-600 dark:text-amber-500">System Admin</a>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    {orgName && (
                        <Badge variant="outline" className="text-sm px-3 py-1">
                            {orgName} <span className="text-muted-foreground ml-1">({orgType})</span>
                        </Badge>
                    )}
                    <UserButton />
                </div>
            </header>
            <main className="p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
