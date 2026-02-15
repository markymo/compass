import { SourcesSubNav } from "@/components/layout/sources-sub-nav";
import prisma from "@/lib/prisma";

interface SourcesLayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default async function SourcesLayout({ children, params }: SourcesLayoutProps) {
    const { id } = await params;

    // Fetch lightweight LE data for side nav context
    const le = await prisma.clientLE.findUnique({
        where: { id },
        select: { jurisdiction: true }
    });

    return (
        <div className="flex gap-8 py-6">
            <aside className="w-64 flex-shrink-0">
                <SourcesSubNav leId={id} jurisdiction={le?.jurisdiction} />
            </aside>
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
}
