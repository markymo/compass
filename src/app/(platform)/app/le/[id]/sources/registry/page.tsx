
import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2 } from "lucide-react";
import { RegistryRefreshButton } from "@/components/client/registry-refresh-button"; // New Import

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;
    const registryData = (le as any).nationalRegistryData;
    const sourceLabel = registryData?.source || "National Registry";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full">
                        <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-emerald-900 dark:text-emerald-100">{sourceLabel} Record</h3>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            Official data fetched directly from the local jurisdiction registry.
                        </p>
                    </div>
                </div>

                <RegistryRefreshButton leId={le.id} lastRefreshed={le.registryFetchedAt} />
            </div>

            {/* Empty State / Initial Fetch Prompt */}
            {!registryData && (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400">
                    <Building2 className="h-10 w-10 mb-3 opacity-30" />
                    <p className="font-medium text-slate-600">No Registry Data Available</p>
                    <p className="text-sm mb-4">Click "Refresh Data" to fetch the latest official records.</p>
                </div>
            )}

            {/* Officers Table */}

            {registryData?.officers && (
                <Card>
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-600" />
                                Directors & Officers
                            </CardTitle>
                            <Badge variant="outline" className="bg-white dark:bg-slate-800 text-slate-500 font-normal">
                                {registryData.officers.length} Found
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium">Name</th>
                                        <th className="px-6 py-3 font-medium">Role</th>
                                        <th className="px-6 py-3 font-medium">Born</th>
                                        <th className="px-6 py-3 font-medium">Appointed</th>
                                        <th className="px-6 py-3 font-medium">Occupation</th>
                                        <th className="px-6 py-3 font-medium">Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {registryData.officers.map((officer: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                            <td className="px-6 py-4">
                                                {officer.resigned_on ? (
                                                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 uppercase">
                                                        Resigned
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] h-5 px-1.5 uppercase">
                                                        Active
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                                {officer.name}
                                            </td>
                                            <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">
                                                {officer.officer_role.replace(/_/g, ' ')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {officer.date_of_birth ?
                                                    `${new Date(officer.date_of_birth.year, officer.date_of_birth.month - 1).toLocaleString('default', { month: 'short' })} ${officer.date_of_birth.year}` :
                                                    '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {officer.appointed_on ? new Date(officer.appointed_on).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {officer.occupation || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                                                {[
                                                    officer.address.premises,
                                                    officer.address.address_line_1,
                                                    officer.address.locality,
                                                    officer.address.postal_code
                                                ].filter(Boolean).join(", ")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
