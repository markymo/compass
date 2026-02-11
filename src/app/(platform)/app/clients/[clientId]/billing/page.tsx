
import { getClientBillingData } from "@/actions/billing";
import { BillingPageClient } from "./client-page";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Building2, CreditCard, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface BillingPageProps {
    params: Promise<{ clientId: string }>;
}

export default async function BillingPage({ params }: BillingPageProps) {
    const { clientId } = await params;
    const response = await getClientBillingData(clientId);

    if (!response.success || !response.data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="p-4 bg-red-50 rounded-full text-red-500">
                    <Building2 className="h-8 w-8" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Access Denied</h1>
                <p className="text-slate-500 max-w-md text-center">
                    {response.error || "You do not have permission to view billing information for this client."}
                </p>
                <Button variant="outline" asChild>
                    <Link href={`/app/clients/${clientId}`}>Return to Dashboard</Link>
                </Button>
            </div>
        );
    }

    const { orgName } = response.data;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: orgName, href: `/app/clients/${clientId}`, icon: Building2 },
                    { label: "Billing", icon: CreditCard }
                ]}
            />

            <main className="max-w-5xl mx-auto w-full p-6 md:p-8 space-y-8">
                <BillingPageClient data={response.data} />
            </main>
        </div>
    );
}
