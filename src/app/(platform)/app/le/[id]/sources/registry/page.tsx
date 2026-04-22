
import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Fingerprint, ShieldCheck } from "lucide-react";
import { RegistryRefreshButton } from "@/components/client/registry-refresh-button";
import { RawPayloadViewer } from "@/components/client/raw-payload-viewer";
import { ExtractedCandidatesViewer } from "@/components/client/extracted-candidates-viewer";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { CanonicalRegistryMapper } from "@/services/kyc/normalization/CanonicalRegistryMapper";
import { RegistryMappingEngine } from "@/services/kyc/normalization/RegistryMappingEngine";
import prisma from "@/lib/prisma";


export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const le = data.le;
    const legalEntityId = le.legalEntityId;

    // 1. Fetch Latest Enrichment Run and Data Layers (Defensive check for model existence)
    const latestRun = (legalEntityId && (prisma as any).enrichmentRun) ? await (prisma as any).enrichmentRun.findFirst({
        where: { legalEntityId },
        include: {
            baselineExtracts: { orderBy: { extractedAt: 'desc' }, take: 1 },
            sourcePayloads: true
        },
        orderBy: { createdAt: 'desc' }
    }) : null;


    const baseline = latestRun?.baselineExtracts[0];
    
    // Re-construct the view model for the UI safely
    let registryData = (le as any).nationalRegistryData;

    if (baseline) {
        try {
            const legacy = (le as any).nationalRegistryData || {};
            registryData = {
                entityName: baseline.legalName || legacy.entityName || legacy.company_name,
                entityStatus: baseline.entityStatus || legacy.entityStatus || legacy.company_status,
                incorporationDate: (baseline.incorporationDate || legacy.incorporationDate || legacy.date_of_creation) 
                    ? new Date(baseline.incorporationDate || legacy.incorporationDate || legacy.date_of_creation).toISOString().split('T')[0] 
                    : null,
                registeredAddress: baseline.registeredAddress || legacy.registeredAddress || legacy.registered_office_address,
                // Pull Officers and PSC from the specific raw payloads
                officers: (latestRun?.sourcePayloads.find((p: any) => p.payloadSubtype === 'OFFICERS')?.payload as any) || legacy.officers || [],
                pscs: (latestRun?.sourcePayloads.find((p: any) => p.payloadSubtype === 'PSC')?.payload as any) || legacy.pscs || [],
                sicCodes: (latestRun?.sourcePayloads.find((p: any) => p.payloadSubtype === 'COMPANY_PROFILE')?.payload as any)?.sic_codes 
                    || legacy.sicCodes || legacy.sic_codes || []
            };
        } catch (e) {
            console.error("Failed to reconstruct registryData from baseline:", e);
        }
    }

    
    // Primary Registry Reference
    const primaryRef = (le as any).registryReferences?.[0];
    const authority = primaryRef?.authority;
    const displayTitle = authority?.name || "Registration Authority Record";

    let extractedCandidates: any[] = [];
    try {
        if (latestRun) {
            extractedCandidates = await RegistryMappingEngine.mapEnrichmentRun(latestRun.id);
        } else if (registryData) {
            extractedCandidates = await CanonicalRegistryMapper.mapToCandidates(registryData, "preview_id");
        }
    } catch (e) {
        console.error("Failed to resolve extracted candidates:", e);
    }



    const rawProfile = latestRun?.sourcePayloads.find((p: any) => p.payloadSubtype === 'COMPANY_PROFILE')?.payload;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SetPageBreadcrumbs 
                items={[]}
            />

            {/* Header */}
            <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-emerald-900/30 p-1 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm overflow-hidden flex items-center justify-center min-w-[40px] h-[40px]">
                        {authority?.id === "RA000585" ? (
                            <img 
                                src="/images/Companies_House.png" 
                                alt="Companies House" 
                                className="h-8 w-auto object-contain"
                            />
                        ) : (
                            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        )}
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

                <div className="flex flex-col items-end gap-2">
                    <RegistryRefreshButton leId={le.id} lastRefreshed={le.registryFetchedAt} />
                    <div className="flex gap-2">
                        {extractedCandidates.length > 0 && (
                            <ExtractedCandidatesViewer candidates={extractedCandidates} />
                        )}
                        <RawPayloadViewer data={rawProfile || (le as any).nationalRegistryData || (le as any).gleifData} />
                    </div>
                </div>
            </div>


            {/* Empty State / Initial Fetch Prompt */}
            {!registryData && (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400">
                    <Building2 className="h-10 w-10 mb-3 opacity-30" />
                    {primaryRef?.status === 'UNSUPPORTED' ? (
                        <>
                            <p className="font-medium text-slate-600 dark:text-slate-300">Integration Not Yet Implemented</p>
                            <p className="text-sm mb-4 text-center max-w-md">An automated data connector for <b>{displayTitle}</b> is on our roadmap. In the meantime, please verify data or upload records manually.</p>
                        </>
                    ) : (
                        <>
                            <p className="font-medium text-slate-600 dark:text-slate-300">No Registry Data Available</p>
                            <p className="text-sm mb-4">Click "Refresh Data" to fetch the latest official records.</p>
                        </>
                    )}
                </div>
            )}

            {/* Integrated Registry Summary Banner */}
            {registryData && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-0.5">Registration Name</h4>
                            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 italic break-words leading-tight">
                                {registryData?.entityName || registryData?.company_name || "-"}
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-8 md:border-l border-slate-100 dark:border-slate-800 md:pl-8">
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Status</h4>
                                <Badge variant={(registryData?.entityStatus || registryData?.company_status) === 'active' ? 'default' : 'outline'} className="shadow-none">
                                    {registryData?.entityStatus || registryData?.company_status || "-"}
                                </Badge>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Incorporated</h4>
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {registryData?.incorporationDate || registryData?.date_of_creation || "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SIC Codes (Sector) */}
            {(registryData?.sicCodes || registryData?.sic_codes) && (registryData?.sicCodes || registryData?.sic_codes).length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Industry Classification (SIC)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(registryData.sicCodes || registryData.sic_codes).map((item: any, idx: number) => (

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
            {(registryData?.pscs || registryData?.persons_with_significant_control) && (registryData.pscs || registryData.persons_with_significant_control).length > 0 && (
                <Card>
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-900/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Fingerprint className="h-4 w-4 text-emerald-600" />
                                Persons with Significant Control (PSC)
                            </CardTitle>
                            <Badge variant="outline" className="bg-white dark:bg-slate-800 text-emerald-600 border-emerald-100 font-normal">
                                {(registryData.pscs || registryData.persons_with_significant_control).length} Identified
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
                                    {(registryData.pscs || registryData.persons_with_significant_control).map((psc: any, idx: number) => (

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
