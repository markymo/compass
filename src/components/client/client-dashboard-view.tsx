"use client"

import { Building2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Landmark, ArrowRight, Shield, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CreateLEDialog } from "./create-le-dialog";
import { ManageLETeamDialog } from "./manage-le-team-dialog";
import { AccessDebugInfo } from "@/components/dev/AccessDebugInfo";
import { JurisdictionBadge } from "@/components/ui/jurisdiction-badge";

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
                        <h2 className="text-xl font-semibold text-foreground">
                            {permissions.canViewAllLEs ? "Legal Entities" : "Your Entities"}
                        </h2>
                        {permissions.canCreateLE && <CreateLEDialog orgId={org.id} />}
                    </div>

                    {les.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card text-card-foreground border-border">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-muted rounded-full shadow-sm">
                                    <Landmark className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No entities found</h3>
                                <p className="text-muted-foreground max-w-sm">
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
                                const memberCount = le.memberships?.length || 0;
                                const inviteCount = le.pendingInvitesCount || (le.invitations?.length || 0);

                                const CardComponent = (
                                    <Card className={`border-border bg-card text-card-foreground shadow-sm transition-all ${isAccessible ? 'hover:shadow-md hover:border-indigo-500/50 cursor-pointer group' : 'opacity-75 bg-muted'}`}>
                                        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row gap-6 md:items-center">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                                                    <h3 className={`font-semibold text-base sm:text-lg ${isAccessible ? 'text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'text-muted-foreground'} truncate`}>
                                                        {le.displayName || le.name}
                                                    </h3>
                                                    <JurisdictionBadge jurisdiction={le.jurisdiction} />
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2">
                                                    {le.description || "No description provided."}
                                                </p>
                                            </div>

                                            {/* Access Area with Manage Team action */}
                                            <div className="w-full md:w-auto md:min-w-[240px] flex flex-col gap-2 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                                                        Access
                                                    </div>
                                                    {permissions.canManageOrg && (
                                                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                                            <ManageLETeamDialog
                                                                clientLEId={le.id}
                                                                clientLEName={le.displayName || le.name}
                                                                orgId={org.id}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="text-xs font-semibold text-foreground">
                                                        {memberCount > 0 ? (
                                                            <>
                                                                {memberCount} {memberCount === 1 ? "user" : "users"}
                                                                {inviteCount > 0 ? ` · ${inviteCount} invited` : ""}
                                                            </>
                                                        ) : inviteCount > 0 ? (
                                                            <>No active users · {inviteCount} invited</>
                                                        ) : (
                                                            <span className="text-muted-foreground font-normal italic">No users assigned</span>
                                                        )}
                                                    </div>

                                                    {memberCount > 0 && (
                                                        <div className="space-y-1">
                                                            {le.memberships.slice(0, 2).map((m: any) => {
                                                                const roleName = m.role || 'Unknown';
                                                                const displayRole = roleName.replace(/_/g, ' ');
                                                                const isAdmin = roleName.includes('ADMIN');

                                                                return (
                                                                    <div key={m.id} className="flex items-center gap-2 text-xs text-foreground w-full">
                                                                        {isAdmin ? (
                                                                            <Shield className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                                        ) : (
                                                                            <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                        )}
                                                                        <span className="truncate flex-1 min-w-0" title={m.user.name || m.user.email}>
                                                                            {m.user.name || m.user.email}
                                                                        </span>
                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 uppercase font-medium ${isAdmin ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : 'bg-muted text-muted-foreground border-border'}`}>
                                                                            {displayRole}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {memberCount > 2 && (
                                                                <div className="text-[10px] text-muted-foreground italic">
                                                                    +{memberCount - 2} more user{memberCount - 2 === 1 ? "" : "s"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isAccessible && (
                                                <div className="hidden md:flex pl-2 items-center justify-center">
                                                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
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
