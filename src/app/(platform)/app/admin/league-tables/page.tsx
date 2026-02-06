
import prisma from "@/lib/prisma";
import { LeagueTableViewer } from "@/components/admin/league-tables/league-table-viewer";

// Types based on our import logic
interface LeagueStats {
    rank: number | string;
    volume: number;
    count: number;
    share: number;
}

interface BankEntry {
    id: string;
    name: string;
    stats: LeagueStats;
}

export default async function LeagueTablesPage() {
    // 1. Fetch all FIs that might have metadata
    const organizations = await prisma.organization.findMany({
        where: {
            types: { has: "FI" }
        },
        select: {
            id: true,
            name: true,
            metadata: true
        }
    });

    // 2. Separate into UK and EU lists
    const ukList: BankEntry[] = [];
    const euList: BankEntry[] = [];

    organizations.forEach(org => {
        const meta = org.metadata as any;
        if (!meta || !meta.leagueTable) return;

        if (meta.leagueTable.uk) {
            ukList.push({
                id: org.id,
                name: org.name,
                stats: meta.leagueTable.uk
            });
        }
        if (meta.leagueTable.eu) {
            euList.push({
                id: org.id,
                name: org.name,
                stats: meta.leagueTable.eu
            });
        }
    });

    // 3. Sort by Rank (numeric handling for '=') and Volume desc
    const sortFn = (a: BankEntry, b: BankEntry) => {
        const rankA = typeof a.stats.rank === 'number' ? a.stats.rank : 999;
        const rankB = typeof b.stats.rank === 'number' ? b.stats.rank : 999;

        if (rankA !== rankB) return rankA - rankB;
        return b.stats.volume - a.stats.volume;
    };

    ukList.sort(sortFn);
    euList.sort(sortFn);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Bank League Tables</h1>
                <p className="text-slate-500">
                    Live target lists imported from source data.
                </p>
            </div>

            <LeagueTableViewer ukList={ukList} euList={euList} />
        </div>
    );
}
