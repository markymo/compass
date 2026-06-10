import prisma from "@/lib/prisma";
import { GroupListHeader } from "@/components/client/admin/group-list-header";
import { GroupsTabView } from "@/components/client/admin/groups-tab-view";

export default async function GroupConfigurationsPage() {
    let groups: any[] = [];
    try {
        groups = await (prisma as any).masterFieldGroup.findMany({
            include: {
                items: {
                    include: {
                        field: true
                    },
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: [
                { category: 'asc' },
                { order: 'asc' }
            ]
        });
    } catch (e) {
        console.error("Failed to fetch groups", e);
    }

    return (
        <div className="space-y-6">
            <GroupListHeader />
            <GroupsTabView groups={groups} />
        </div>
    );
}
