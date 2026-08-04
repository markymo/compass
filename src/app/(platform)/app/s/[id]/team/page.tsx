import { getFIOganization, getSupplierTeamMembers } from "@/actions/fi";
import { notFound } from "next/navigation";
import { FIDashboardHeader } from "@/components/fi/fi-dashboard-header";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getFIPortalTabs } from "@/config/navigation-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Shield, Building2 } from "lucide-react";
import { format } from "date-fns";

export default async function FITeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [org, teamSummary] = await Promise.all([
        getFIOganization(id),
        getSupplierTeamMembers(id),
    ]);

    if (!org) return notFound();

    const fiTabs = getFIPortalTabs(org.id);
    const { members, pendingInvitations } = teamSummary;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <SetPageBreadcrumbs
                items={[
                    { label: "Home", href: "/app", iconName: "home" },
                    { label: org.name, href: `/app/s/${id}`, iconName: "landmark" },
                    { label: "Teams", iconName: "users" }
                ]}
                title="Teams"
                typeLabel="Financial Institution"
                secondaryNav={<HeaderNavList items={fiTabs} />}
            />

            <FIDashboardHeader org={org} />

            <div className="max-w-7xl mx-auto w-full p-8 space-y-6 pb-20">
                {/* Header Info */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            People with access to {org.name} and its Client Legal Entity Relationships.
                        </p>
                    </div>
                </div>

                {/* Current Members Card */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                                <Users className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-bold text-slate-900">Team Members ({members.length})</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">
                                    Current organization members and relationship assignees.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                                    <tr>
                                        <th className="px-6 py-3 font-extrabold">User</th>
                                        <th className="px-6 py-3 font-extrabold">Role</th>
                                        <th className="px-6 py-3 font-extrabold">Access Scope</th>
                                        <th className="px-6 py-3 font-extrabold text-right">Joined</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {members.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                                                No team members are currently available for this Supplier.
                                            </td>
                                        </tr>
                                    ) : (
                                        members.map((m) => {
                                            const initials = m.name
                                                ? m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                                                : m.email.charAt(0).toUpperCase();

                                            return (
                                                <tr key={m.userId} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-xl bg-teal-100/70 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                                                                {initials}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-slate-900 truncate">
                                                                    {m.name || "Unnamed User"}
                                                                </div>
                                                                <div className="text-slate-500 text-[11px] truncate flex items-center gap-1">
                                                                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                                                    {m.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <Badge variant="outline" className="text-[11px] font-semibold border-slate-200 text-slate-700 bg-slate-50/50">
                                                            <Shield className="h-3 w-3 text-teal-600 mr-1.5" />
                                                            {m.roleLabel}
                                                        </Badge>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        {m.accessScope.kind === "SUPPLIER" ? (
                                                            <Badge variant="outline" className="text-[11px] font-semibold border-teal-200 text-teal-800 bg-teal-50/60">
                                                                All Relationships
                                                            </Badge>
                                                        ) : m.accessScope.relationships && m.accessScope.relationships.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 max-w-md">
                                                                {m.accessScope.relationships.map((rel) => (
                                                                    <Badge key={rel.id} variant="outline" className="text-[11px] font-medium border-slate-200 text-slate-600 bg-white">
                                                                        <Building2 className="h-3 w-3 text-slate-400 mr-1" />
                                                                        {rel.clientLEName}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">No specific relationship</span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-right text-slate-500 font-medium">
                                                        {m.joinedAt ? format(new Date(m.joinedAt), "dd MMM yyyy") : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Invitations Section */}
                {pendingInvitations.length > 0 && (
                    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="border-b bg-amber-50/30 px-6 py-4">
                            <CardTitle className="text-base font-bold text-slate-900">
                                Pending Invitations ({pendingInvitations.length})
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 font-medium">
                                Outstanding invitations to join {org.name} or specific Relationships.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                                        <tr>
                                            <th className="px-6 py-3 font-extrabold">Recipient Email</th>
                                            <th className="px-6 py-3 font-extrabold">Role</th>
                                            <th className="px-6 py-3 font-extrabold">Access Scope</th>
                                            <th className="px-6 py-3 font-extrabold text-right">Invited</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {pendingInvitations.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-6 py-4 font-semibold text-slate-900">
                                                    {inv.email}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="text-[11px] font-semibold border-amber-200 text-amber-800 bg-amber-50/50">
                                                        {inv.roleLabel}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-600">
                                                    {inv.accessScope}
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500 font-medium">
                                                    {format(new Date(inv.invitedAt), "dd MMM yyyy")}
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
        </div>
    );
}
