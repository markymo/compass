
import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Fingerprint, ShieldCheck } from "lucide-react";
import { RegistryRefreshButton } from "@/components/client/registry-refresh-button"; // New Import

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const le = data.le;
    const registryData = (le as any).nationalRegistryData;
    
    // Primary Registry Reference (usually just one)
    const primaryRef = (le as any).registryReferences?.[0];
    const authority = primaryRef?.authority;

    // Support both old and new data formats
    const sourceType = registryData?.sourceType || (registryData?.source === "Companies House" ? "COMPANIES_HOUSE" : null);
    const displayTitle = authority?.name || (sourceType === "COMPANIES_HOUSE" ? "UK Companies House" : "National Registry Record");

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-lg tracking-tight">{displayTitle}</h3>
                            {primaryRef && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono text-emerald-600 border-emerald-200 bg-emerald-50">
                                    {authority?.id} • {primaryRef.localRegistrationNumber}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            Official record retrieved from local jurisdiction registry
                        </p>
                    </div>
                </div>

                <RegistryRefreshButton leId={le.id} lastRefreshed={le.registryFetchedAt} />
            </div>

            {/* Empty State / Initial Fetch Prompt */}
            {!registryData && (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400">
                    <Building2 className="h-10 w-10 mb-3 opacity-30" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No Registry Data Available</p>
                    <p className="text-sm mb-4">Click "Refresh Data" to fetch the latest official records.</p>
                </div>
            )}

            {/* Entity Summary (Basic Info from Registry) */}
            {registryData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Registration Name</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 italic truncate">
                                {registryData?.entityName || registryData?.company_name || "-"}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Registry Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge variant={(registryData?.entityStatus || registryData?.company_status) === 'active' ? 'default' : 'outline'}>
                                {registryData?.entityStatus || registryData?.company_status || "-"}
                            </Badge>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Incorporation Date</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-medium">
                                {registryData?.incorporationDate || registryData?.date_of_creation || "-"}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* SIC Codes (Sector) */}
            {registryData?.sicCodes && registryData.sicCodes.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Industry Classification (SIC)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {registryData.sicCodes.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-md">
                                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{typeof item === 'string' ? item : item.code}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-2">
                                    {typeof item === 'string' ? '-' : (item.description || "Sector description not available")}
                                </span>
                            </div>
                        ))}
                    </div>
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
                                    {(registryData.officers || []).filter(Boolean).map((officer: any, idx: number) => (
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
                                                {officer.officer_role?.replace(/_/g, ' ') || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {officer.date_of_birth?.year && officer.date_of_birth?.month ?
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
                                                    officer.address?.premises,
                                                    officer.address?.address_line_1,
                                                    officer.address?.locality,
                                                    officer.address?.postal_code
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

            {/* PSC Table (Persons with Significant Control) */}
            {registryData?.pscs && registryData.pscs.length > 0 && (
                <Card>
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-900/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Fingerprint className="h-4 w-4 text-emerald-600" />
                                Persons with Significant Control (PSC)
                            </CardTitle>
                            <Badge variant="outline" className="bg-white dark:bg-slate-800 text-emerald-600 border-emerald-100 font-normal">
                                {registryData.pscs.length} Identified
                            </Badge>
                        </div>
                        <CardDescription className="text-xs mt-1">
                            Ultimate Beneficial Owners (UBOs) and controllers as declared to the registry.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Name / Entity</th>
                                        <th className="px-6 py-3 font-medium">Nature of Control</th>
                                        <th className="px-6 py-3 font-medium">Nationality</th>
                                        <th className="px-6 py-3 font-medium">Notified</th>
                                        <th className="px-6 py-3 font-medium">Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {registryData.pscs.map((psc: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900 dark:text-slate-100">{psc.name}</div>
                                                <div className="text-[10px] text-slate-500 uppercase">{psc.kind?.replace(/-/g, ' ')}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(psc.natures_of_control || []).map((nature: string, nIdx: number) => (
                                                        <Badge key={nIdx} variant="outline" className="text-[9px] leading-tight px-1 py-0 border-slate-200 bg-slate-50 text-slate-600 lowercase whitespace-nowrap">
                                                            {nature.replace(/-/g, ' ')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {psc.nationality || psc.country_of_residence || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {psc.notified_on ? new Date(psc.notified_on).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                                                {[
                                                    psc.address?.premises,
                                                    psc.address?.address_line_1,
                                                    psc.address?.locality,
                                                    psc.address?.postal_code
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
