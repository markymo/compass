import { getUserContexts } from "@/actions/dashboard";
import { getAuthenticatedPendingInvitations } from "@/actions/invitations";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { HomeResponsiveContent } from "@/components/dashboard/labs/home-responsive-content";
import { PendingInvitationsBanner } from "@/components/dashboard/pending-invitations-banner";
import { Home, Beaker } from "lucide-react";

export default async function ResponsiveHomeLabPage() {
    const [contexts, pendingInvitations] = await Promise.all([
        getUserContexts(),
        getAuthenticatedPendingInvitations(),
    ]);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground" data-testid="responsive-home">
            <StandardPageHeader
                title="Relationships"
                subtitle="Your Organisations, Legal Entities and Relationships."
                typeLabel="Responsive Home Lab"
                breadcrumbs={[
                    { label: "Home", href: "/app", icon: Home },
                    { label: "Responsive Home Lab", href: "/app/labs/home-responsive", icon: Beaker },
                ]}
            />

            <div className="w-full max-w-7xl mx-auto py-6 sm:py-8 space-y-6">
                {pendingInvitations.length > 0 && (
                    <PendingInvitationsBanner invitations={pendingInvitations} />
                )}
                <HomeResponsiveContent contexts={contexts} />
            </div>
        </div>
    );
}
