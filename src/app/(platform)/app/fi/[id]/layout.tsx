import { notFound, redirect } from "next/navigation";
import { getFIOganization } from "@/actions/fi";
import { Building2 } from "lucide-react";

export default async function FILayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // We can keep the check for validity, but remove UI noise
    const org = await getFIOganization(id);

    if (!org) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight">404</h1>
                <p className="text-lg text-muted-foreground">This page could not be found.</p>
            </div>
        );
    }

    return (
        <>
            {children}
        </>
    );
}
