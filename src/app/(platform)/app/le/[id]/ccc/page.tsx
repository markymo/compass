import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, ShieldCheck } from "lucide-react";

interface CCCPageProps {
    params: Promise<{ id: string }>;
}

export default async function CCCPage({ params }: CCCPageProps) {
    const { id } = await params;

    // Verify Legal Entity existence
    const le = await prisma.clientLE.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!le) {
        return notFound();
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <SetPageBreadcrumbs
                items={[
                    { label: "CCC", href: `/app/le/${id}/ccc` }
                ]}
            />

            {/* Header Area */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800">
                    <Layers className="h-6 w-6 text-slate-500" />
                    <h2 className="text-xl font-semibold tracking-tight">CoParity Curated Content</h2>
                </div>
                <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                    This area will manage CoParity-curated records such as curated parties, promoted claims, reusable contacts, organisations, trusts and future reference data.
                </p>
            </div>

            {/* Content Cards */}
            <div className="grid gap-6 md:grid-cols-1">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-3 pb-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Curated Parties</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Curated Party management will be added here. Source claims from Companies House, GLEIF or user input will be promotable into reusable CoParity-curated parties.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
