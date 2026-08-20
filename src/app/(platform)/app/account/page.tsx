"use client";

import { useEffect, useState } from "react";
import { getAccountSettings, updateAccountSettings, getUserPermissions } from "@/actions/account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, User, Bell, Home, Key, ExternalLink, Sparkles, Factory, Building2, Landmark, Gavel } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { useBreadcrumbs } from "@/context/breadcrumb-context";
import { cn } from "@/lib/utils";

function PermissionBadge({ label }: { label: string }) {
    if (!label || label === "—") {
        return <span className="text-slate-400 font-mono text-sm">—</span>;
    }

    let colorClasses = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    if (["ORG_ADMIN", "ADMIN", "CLIENT_ADMIN", "LE_ADMIN", "SUPPLIER_ADMIN", "RELATIONSHIP_ADMIN"].includes(label)) {
        colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
    }

    return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold font-mono uppercase border", colorClasses)}>
            {label.replace(/_/g, " ")}
        </span>
    );
}

export default function AccountSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [profile, setProfile] = useState<any>(null);
    const [name, setName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [phone, setPhone] = useState("");
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [permissions, setPermissions] = useState<any>(null);
    const { preferences, updatePreference } = usePreferences();

    useEffect(() => {
        async function fetchSettings() {
            setLoading(true);
            const res = await getAccountSettings();
            if (res.success && res.data) {
                setProfile(res.data);
                setName(res.data.name || "");
                // @ts-ignore: Prisma client cache lag
                setJobTitle(res.data.jobTitle || "");
                // @ts-ignore
                setPhone(res.data.phone || "");
                // @ts-ignore
                setEmailEnabled((res.data.notificationPrefs as any)?.emailEnabled ?? true);
            } else {
                toast.error("Failed to load account settings.");
            }
            setLoading(false);
        }

        async function fetchPermissions() {
            const res = await getUserPermissions();
            if (res.success && res.data) {
                setPermissions(res.data);
            }
        }

        fetchSettings();
        fetchPermissions();
    }, []);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await updateAccountSettings({
            name,
            jobTitle,
            phone,
            notificationPrefs: {
                ...profile.notificationPrefs,
                emailEnabled
            }
        });

        if (res.success) {
            toast.success("Account settings updated successfully.");
            router.refresh(); // Refresh to update UserNav avatar if name changed
        } else {
            toast.error(res.error || "Failed to save settings.");
        }
        setSaving(false);
    };

    const { currentBreadcrumbs } = useBreadcrumbs();

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <StandardPageHeader
                title="Account Settings"
                typeLabel="Settings"
                subtitle="Manage your personal profile, security and preferences."
                breadcrumbs={currentBreadcrumbs}
            />

            <div className="space-y-6 max-w-7xl mx-auto pb-12 px-6 py-8 w-full">

            <div className="grid gap-6 md:grid-cols-12 pt-4">
                {/* Main Content Area */}
                <div className="md:col-span-8 space-y-6">

                    {/* Personal Details */}
                    <Card className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm py-0 gap-0">
                        <form onSubmit={handleSaveProfile}>
                            <CardHeader className="p-6 pb-4">
                                <div className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-indigo-500" />
                                    <CardTitle>Personal Details</CardTitle>
                                </div>
                                <CardDescription>Update your personal information used across the platform.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 px-6 pb-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                                    <Input id="email" value={profile.email} disabled className="bg-slate-50 text-slate-500" autoComplete="off" />
                                    <p className="text-[13px] text-muted-foreground">Your email address is managed by your identity provider and cannot be changed here.</p>
                                </div>
                                <div className="grid gap-2 pt-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Jane Doe" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="jobTitle">Job Title (Optional)</Label>
                                        <Input id="jobTitle" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Compliance Officer" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="phone">Phone Number (Optional)</Label>
                                        <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0123" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 flex justify-end">
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    {/* Security */}
                    <Card className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm py-0 gap-0">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-500" />
                                <CardTitle>Security</CardTitle>
                            </div>
                            <CardDescription>Manage how you sign in and secure your account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-6 pb-6">
                            <div className="flex justify-between items-center py-2 border-b">
                                <div>
                                    <p className="font-medium">Authentication Method</p>
                                    <p className="text-sm text-muted-foreground">How you currently sign in.</p>
                                </div>
                                <div className="text-sm font-medium px-3 py-1 bg-slate-100 rounded-md">
                                    {profile.authMethod}
                                </div>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b">
                                <div>
                                    <p className="font-medium">Password</p>
                                    <p className="text-sm text-muted-foreground">Change your password if you use email/password auth.</p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    {profile.authMethod.includes("SSO") ? (
                                        <span className="opacity-50 cursor-not-allowed">Managed via SSO</span>
                                    ) : (
                                        <a href="/reset-password">Reset Password</a>
                                    )}
                                </Button>
                            </div>

                            <div className="flex justify-between items-center py-2">
                                <div>
                                    <p className="font-medium">Multi-Factor Authentication (MFA)</p>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                </div>
                                <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md font-medium border border-amber-200">
                                    Not configured
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Permissions */}
                    <Card className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm py-0 gap-0">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-blue-500" />
                                <CardTitle>Permissions</CardTitle>
                            </div>
                            <CardDescription>Review your direct access and roles across organizations and legal entities.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(!permissions || (
                                (!permissions.clients || permissions.clients.length === 0) &&
                                (!permissions.suppliers || permissions.suppliers.length === 0) &&
                                (!permissions.others || permissions.others.length === 0)
                            )) ? (
                                <div className="p-6 text-center text-sm text-muted-foreground italic">
                                    No specific memberships or permissions found.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b">
                                        <div className="col-span-8">Organisation / ClientLE</div>
                                        <div className="col-span-4 text-right">Your permission</div>
                                    </div>

                                    {/* 1. CLIENTS */}
                                    {permissions.clients && permissions.clients.length > 0 && (
                                        <div>
                                            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-2 border-y border-indigo-100/50 dark:border-indigo-900/30 flex items-center gap-2">
                                                <Factory className="h-3.5 w-3.5 text-indigo-600" />
                                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                                    Clients
                                                </h4>
                                            </div>
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                {permissions.clients.map((client: any) => (
                                                    <div key={client.id}>
                                                        {/* Parent Client Org Row */}
                                                        <div className="grid grid-cols-12 items-center p-3 px-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                                                            <div className="col-span-8 flex items-center gap-2">
                                                                <Factory className="h-4 w-4 text-indigo-500 shrink-0" />
                                                                <Link
                                                                    href={client.href}
                                                                    className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-indigo-600 transition-colors text-sm"
                                                                >
                                                                    {client.name}
                                                                    <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                                </Link>
                                                            </div>
                                                            <div className="col-span-4 text-right">
                                                                <PermissionBadge label={client.permissionLabel} />
                                                            </div>
                                                        </div>

                                                        {/* Indented Child ClientLEs */}
                                                        {client.children && client.children.map((le: any) => (
                                                            <div key={le.id} className="grid grid-cols-12 items-center p-2.5 pl-12 pr-6 hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors group border-t border-slate-50 dark:border-slate-800/30">
                                                                <div className="col-span-8 flex items-center gap-2">
                                                                    <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                                    <Link
                                                                        href={le.href}
                                                                        className="font-medium text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                                                                    >
                                                                        {le.name}
                                                                        <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                                    </Link>
                                                                </div>
                                                                <div className="col-span-4 text-right">
                                                                    <PermissionBadge label={le.permissionLabel} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. SUPPLIERS */}
                                    {permissions.suppliers && permissions.suppliers.length > 0 && (
                                        <div>
                                            <div className="bg-teal-50/50 dark:bg-teal-950/20 px-6 py-2 border-y border-teal-100/50 dark:border-teal-900/30 flex items-center gap-2">
                                                <Building2 className="h-3.5 w-3.5 text-teal-600" />
                                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300">
                                                    Suppliers
                                                </h4>
                                            </div>
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                {permissions.suppliers.map((supplier: any) => (
                                                    <div key={supplier.id}>
                                                        {/* Parent Supplier Org Row */}
                                                        <div className="grid grid-cols-12 items-center p-3 px-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                                                            <div className="col-span-8 flex items-center gap-2">
                                                                <Building2 className="h-4 w-4 text-teal-600 shrink-0" />
                                                                <Link
                                                                    href={supplier.href}
                                                                    className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-teal-600 transition-colors text-sm"
                                                                >
                                                                    {supplier.name}
                                                                    <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                                </Link>
                                                            </div>
                                                            <div className="col-span-4 text-right">
                                                                <PermissionBadge label={supplier.permissionLabel} />
                                                            </div>
                                                        </div>

                                                        {/* Indented Child Relationships */}
                                                        {supplier.children && supplier.children.map((rel: any) => (
                                                            <div key={rel.id} className="grid grid-cols-12 items-center p-2.5 pl-12 pr-6 hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors group border-t border-slate-50 dark:border-slate-800/30">
                                                                <div className="col-span-8 flex items-center gap-2">
                                                                    <Landmark className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                                                    <Link
                                                                        href={rel.href}
                                                                        className="font-medium text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 hover:text-teal-600 transition-colors"
                                                                    >
                                                                        {rel.name}
                                                                        <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                                    </Link>
                                                                </div>
                                                                <div className="col-span-4 text-right">
                                                                    <PermissionBadge label={rel.permissionLabel} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. OTHERS */}
                                    {permissions.others && permissions.others.length > 0 && (
                                        <div>
                                            <div className="bg-purple-50/50 dark:bg-purple-950/20 px-6 py-2 border-y border-purple-100/50 dark:border-purple-900/30 flex items-center gap-2">
                                                <Gavel className="h-3.5 w-3.5 text-purple-600" />
                                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                                                    Others
                                                </h4>
                                            </div>
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                {permissions.others.map((other: any) => (
                                                    <div key={other.id} className="grid grid-cols-12 items-center p-3 px-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                                                        <div className="col-span-8 flex items-center gap-2">
                                                            <Gavel className="h-4 w-4 text-purple-500 shrink-0" />
                                                            <Link
                                                                href={other.href}
                                                                className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-purple-600 transition-colors text-sm"
                                                            >
                                                                {other.name}
                                                                <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                            </Link>
                                                        </div>
                                                        <div className="col-span-4 text-right">
                                                            <PermissionBadge label={other.permissionLabel} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>


                </div>

                {/* Sidebar Area */}
                <div className="md:col-span-4 space-y-6">
                    {/* Personalization (Whimsy Mode) */}
                    <Card className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm py-0 gap-0">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                <CardTitle>Personalization & Regional</CardTitle>
                            </div>
                            <CardDescription>Customize your workflow and regional settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 px-6 pb-6">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="flex flex-col space-y-1">
                                    <Label htmlFor="timezone-select" className="font-medium">System Timezone</Label>
                                    <span className="text-[13px] text-muted-foreground">Used for system timestamps (e.g. audit logs). Defaults to UTC.</span>
                                </div>
                                <div className="w-[180px]">
                                    <select 
                                        id="timezone-select"
                                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={preferences.timezone || 'UTC'}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            await updatePreference("timezone", val);
                                            toast.success("Timezone updated.");
                                        }}
                                    >
                                        <option value="UTC">UTC (Default)</option>
                                        <option value="Europe/London">Europe/London</option>
                                        <option value="America/New_York">America/New_York</option>
                                        <option value="Europe/Paris">Europe/Paris</option>
                                        <option value="Asia/Tokyo">Asia/Tokyo</option>
                                        <option value="Australia/Sydney">Australia/Sydney</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between space-x-2">
                                <div className="flex flex-col space-y-1">
                                    <Label htmlFor="whimsy-mode" className="font-medium inline-flex items-center gap-2">
                                        Whimsy Mode
                                    </Label>
                                    <span className="text-[13px] text-muted-foreground">Enable lighthearted labels (e.g., "big sleeps" for deadlines).</span>
                                </div>
                                <Switch
                                    id="whimsy-mode"
                                    checked={!!preferences.whimsyMode}
                                    onCheckedChange={async (val) => {
                                        await updatePreference("whimsyMode", val);
                                        toast.success(val ? "Whimsy Mode activated! ✨" : "Whimsy Mode deactivated.");
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications */}
                    <Card className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm py-0 gap-0">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-amber-500" />
                                <CardTitle>Notifications</CardTitle>
                            </div>
                            <CardDescription>Control how and when you are alerted.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 px-6 pb-6">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="flex flex-col space-y-1">
                                    <Label htmlFor="email-prefs" className="font-medium">Email Notifications</Label>
                                    <span className="text-[13px] text-muted-foreground">Receive digest and alert emails.</span>
                                </div>
                                <Switch
                                    id="email-prefs"
                                    checked={emailEnabled}
                                    onCheckedChange={async (val) => {
                                        setEmailEnabled(val);
                                        // Auto save preference
                                        await updateAccountSettings({ notificationPrefs: { emailEnabled: val } });
                                        toast.success("Notification preferences updated.");
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            </div>
        </div>
    );
}
