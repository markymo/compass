
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Calendar, MapPin, Globe, Fingerprint, Building2, CheckCircle2, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GleifTabProps {
    data: any; // Raw GLEIF JSON
    fetchedAt: Date | string | null;
}

export function GleifTab({ data, fetchedAt }: GleifTabProps) {
    if (!data || !data.attributes) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p>No GLEIF data available for this entity.</p>
                <p className="text-sm">Add an LEI in the Overview tab to fetch data.</p>
            </div>
        );
    }

    const attr = data.attributes;
    const entity = attr.entity;
    const reg = attr.registration;

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard`);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header / Info Bar */}
            <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-blue-900 dark:text-blue-100">Official GLEIF Record</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Data verified against the Global Legal Entity Identifier Foundation.
                        </p>
                    </div>
                </div>
                {fetchedAt && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-md border shadow-sm">
                        <Clock className="h-3.5 w-3.5" />
                        Last Refreshed: {new Date(fetchedAt).toLocaleString()}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Core Identity */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Fingerprint className="h-4 w-4 text-slate-500" />
                            Identity Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Legal Name</label>
                            <div className="font-medium text-lg text-slate-900 dark:text-slate-100">
                                {entity.legalName?.name}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="group relative">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">LEI Code</label>
                                <div className="font-mono text-sm mt-1 flex items-center gap-2">
                                    {attr.lei}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(attr.lei, "LEI")}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entity Status</label>
                                <div className="mt-1">
                                    <Badge variant={entity.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                        {entity.status}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Legal Jurisdiction</label>
                                <div className="text-sm mt-1 flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                                    {entity.jurisdiction}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entity Category</label>
                                <div className="text-sm mt-1 capitalize">
                                    {entity.category?.replace(/_/g, ' ').toLowerCase()}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Local Registration</label>
                                <div className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                                    ID: <span className="font-mono">{entity.registeredAs}</span>
                                    {entity.registeredAt?.id && (
                                        <span className="text-slate-400 ml-2 text-xs">({entity.registeredAt.id})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Registration Details */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            Registration Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-sm font-medium">Status</span>
                            <Badge variant={reg.status === 'ISSUED' ? 'outline' : 'destructive'} className="bg-white">
                                {reg.status}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Initial Registration</label>
                                <div className="text-sm mt-1">{formatDate(reg.initialRegistrationDate)}</div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Last Update</label>
                                <div className="text-sm mt-1">{formatDate(reg.lastUpdateDate)}</div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Next Renewal</label>
                                <div className="text-sm mt-1 font-medium text-amber-600 dark:text-amber-500">
                                    {formatDate(reg.nextRenewalDate)}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Managing LOU</label>
                            <div className="text-sm mt-1 truncate" title={reg.managingLou}>
                                {reg.managingLou}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                                {reg.corroborationLevel?.replace(/_/g, ' ').toLowerCase()}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Addresses - Full Width */}
                <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            Address Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        {/* Legal Address */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Legal Address
                            </h4>
                            <div className="pl-3.5 border-l-2 border-slate-100 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                {entity.legalAddress?.addressLines?.map((line: string, i: number) => (
                                    <div key={i}>{line}</div>
                                ))}
                                <div className="mt-2 font-medium text-slate-800 dark:text-slate-200">
                                    {entity.legalAddress?.city} {entity.legalAddress?.postalCode}
                                </div>
                                <div>{entity.legalAddress?.country}</div>
                            </div>
                        </div>

                        {/* HQ Address (Only if different usually, but data might be same, show anyway for completeness) */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Headquarters Address
                            </h4>
                            <div className="pl-3.5 border-l-2 border-slate-100 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                {entity.headquartersAddress?.addressLines?.map((line: string, i: number) => (
                                    <div key={i}>{line}</div>
                                ))}
                                <div className="mt-2 font-medium text-slate-800 dark:text-slate-200">
                                    {entity.headquartersAddress?.city} {entity.headquartersAddress?.postalCode}
                                </div>
                                <div>{entity.headquartersAddress?.country}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>


        </div>
    );
}
