import prisma from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid } from "lucide-react";
import { GroupListHeader } from "@/components/client/admin/group-list-header";
import { GroupActions } from "@/components/client/admin/group-actions";

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

            <div className="grid gap-6">
                {groups.map((group: any) => (
                    <div key={group.id} className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                                    <LayoutGrid className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{group.label}</h3>
                                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest leading-none mt-1">{group.key}</p>
                                </div>
                                <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-normal border-none">
                                    {group.category || "Uncategorized"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                {group.isActive ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">Active</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800">Inactive</Badge>
                                )}
                                <GroupActions group={group} />
                            </div>
                        </div>
                        <div className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="pl-6 w-[80px] text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Linked Field</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right pr-6">Picker Visibility</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.items.map((item: any) => (
                                        <TableRow key={item.id} className="group/row hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                            <TableCell className="pl-6 font-mono text-xs text-slate-400">
                                                <Badge variant="outline" className="font-mono text-[10px] border-slate-100 dark:border-slate-800 text-slate-400 px-1.5 min-w-[24px] justify-center">
                                                    {item.order}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                        {item.field?.fieldName || `Field ${item.fieldNo}`}
                                                    </span>
                                                    <span className="text-[10px] text-slate-300 font-mono tracking-tighter">(No. {item.fieldNo})</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {item.hideFromFieldPicker ? (
                                                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/30">Hides Standalone</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-medium italic">Visible Standalone</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {group.items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-16 text-center text-xs text-slate-400 italic">
                                                No fields mapped to this group yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {group.description && (
                            <div className="px-6 py-3 bg-slate-50/30 dark:bg-slate-900/10 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex gap-2 items-start">
                                    <div className="mt-0.5 w-3 h-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                        <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400">i</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 italic">
                                        {group.description}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

