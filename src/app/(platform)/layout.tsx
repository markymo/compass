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
                    <nav className="text-sm text-muted-foreground space-x-4 flex items-center">
                        <a href="/app" className="hover:text-foreground">Dashboard</a>
                        <a href="/app/admin/schema" className="hover:text-foreground">Schema Engine</a>
                        <a href="/app/admin/mapper" className="hover:text-foreground">AI Mapper</a>
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
