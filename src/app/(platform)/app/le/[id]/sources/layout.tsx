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
        <div className="space-y-5 py-6">
            {/* Sources context banner — full width above sidebar+content */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2">
                        <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Sources — Raw Evidence</h3>
                        <p className="mt-0.5 text-sm text-slate-500 leading-relaxed">
                            Sources are the unstructured inputs we draw on to build our understanding of this Legal Entity — official registries, regulatory filings, uploaded documents, and verified data feeds. Think of this as the evidence layer: everything here is raw and traceable, before it has been reviewed, reconciled, and promoted into the <span className="font-medium text-slate-700">Master Record</span>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sidebar + content */}
            <div className="flex gap-8">
                <aside className="w-64 flex-shrink-0">
                    <SourcesSubNav leId={id} jurisdiction={le?.jurisdiction} />
                </aside>
                <div className="flex-1 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
