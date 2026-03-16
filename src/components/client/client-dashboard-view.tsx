"use client"

import { Building2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Landmark, ArrowRight, Shield, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CreateLEDialog } from "./create-le-dialog";
import { AccessDebugInfo } from "@/components/dev/AccessDebugInfo";

interface ClientDashboardViewProps {
    org: any;
    les: any[];
    permissions: any;
    roleLabel: string;
    userId: string;
    email: string | null;
}

export function ClientDashboardView({ 
    org, 
    les, 
    permissions, 
    roleLabel, 
    userId, 
    email
}: ClientDashboardViewProps) {
    return (
        <div className="pb-12 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Entity List */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-800">
                            {permissions.canViewAllLEs ? "Legal Entities" : "Your Entities"}
                        </h2>
                        {permissions.canCreateLE && <CreateLEDialog orgId={org.id} />}
                    </div>

                    {les.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <Landmark className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">No entities found</h3>
                                <p className="text-slate-500 max-w-sm">
                                    {permissions.canCreateLE
                                        ? "Create your first legal entity to start managing your compliance data."
                                        : "You don't have access to any Legal Entities yet."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {les.map((le: any) => {
                                const isAccessible = le.myPermissions?.canEnter;
                                const CardComponent = (
                                    <Card className={`border-slate-200 shadow-sm transition-all ${isAccessible ? 'hover:shadow-md hover:border-indigo-200 cursor-pointer group' : 'opacity-75 bg-slate-50'}`}>
                                        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row gap-6 md:items-center">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                                                    <h3 className={`font-semibold text-base sm:text-lg ${isAccessible ? 'text-slate-900 group-hover:text-indigo-700' : 'text-slate-700'} truncate`}>
                                                        {le.name}
                                                    </h3>
                                                    <Badge variant="outline" className="text-xs font-normal text-slate-600 bg-slate-50 shrink-0">
                                                        {le.jurisdiction || 'Unknown'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-1 sm:line-clamp-2">
                                                    {le.description || "No description provided."}
                                                </p>
                                            </div>

                                            {le.memberships && le.memberships.length > 0 && (
                                                <div className="w-full md:w-auto md:min-w-[220px] flex flex-col gap-1.5 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1 hidden md:block">Access</div>
                                                    {le.memberships.map((m: any) => {
                                                        const roleName = m.role || 'Unknown';
                                                        const displayRole = roleName.replace(/_/g, ' ');
                                                        const isAdmin = roleName.includes('ADMIN');

                                                        return (
                                                            <div key={m.id} className="flex items-center gap-2 text-sm text-slate-600 w-full">
                                                                {isAdmin ? (
                                                                    <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                                                ) : (
                                                                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                                )}
                                                                <span className="font-medium truncate flex-1 min-w-0 text-xs sm:text-sm" title={m.user.name || m.user.email}>
                                                                    {m.user.name || m.user.email}
                                                                </span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 uppercase ${isAdmin ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                                    {displayRole}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {isAccessible && (
                                                <div className="hidden md:flex pl-2 items-center justify-center">
                                                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );

                                return isAccessible ? (
                                    <Link key={le.id} href={`/app/le/${le.id}`} className="block">
                                        {CardComponent}
                                    </Link>
                                ) : (
                                    <div key={le.id}>
                                        {CardComponent}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-12">
                    <AccessDebugInfo
                        data={{
                            userId,
                            email: email as string | undefined,
                            roleLabel,
                            permissions,
                            contextId: org.id,
                            contextName: org.name
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
