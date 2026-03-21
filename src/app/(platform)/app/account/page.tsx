"use client";

import { useEffect, useState } from "react";
import { getAccountSettings, updateAccountSettings, getUserPermissions } from "@/actions/account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, User, Bell, Home, Key, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { useBreadcrumbs } from "@/context/breadcrumb-context";

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
    const [permissions, setPermissions] = useState<any[]>([]);
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

            <div className="space-y-6 max-w-4xl mx-auto pb-12 px-6 py-8 w-full">

            <div className="grid gap-6 md:grid-cols-12 pt-4">
                {/* Main Content Area */}
                <div className="md:col-span-8 space-y-6">

                    {/* Personal Details */}
                    <Card>
                        <form onSubmit={handleSaveProfile}>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-indigo-500" />
                                    <CardTitle>Personal Details</CardTitle>
                                </div>
                                <CardDescription>Update your personal information used across the platform.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                                    <Input id="email" value={profile.email} disabled className="bg-slate-50 text-slate-500" />
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
                            <CardFooter className="border-t px-6 py-4 bg-slate-50 flex justify-end">
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    {/* Security */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-500" />
                                <CardTitle>Security</CardTitle>
                            </div>
                            <CardDescription>Manage how you sign in and secure your account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
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
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-blue-500" />
                                <CardTitle>Permissions</CardTitle>
                            </div>
                            <CardDescription>Review your access and roles across the platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {permissions.length === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground italic">
                                    No specific memberships or permissions found.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {permissions.reduce((acc: any[], item: any, index: number) => {
                                        const prevItem = index > 0 ? permissions[index - 1] : null;
                                        const showHeader = !prevItem || prevItem.priority !== item.priority;

                                        if (showHeader) {
                                            acc.push(
                                                <div key={`header-${item.priority}`} className="bg-slate-50/80 dark:bg-slate-900/80 px-6 py-2 border-y border-slate-100 dark:border-slate-800 first:border-t-0">
                                                    <h4 className="text-[11px] font-semibold text-slate-500">
                                                        {item.priority === 1 ? "Clients" :
                                                            item.priority === 2 ? "Legal Entities" :
                                                                item.priority === 3 ? "Financial Institutions" : "Other Organizations"}
                                                    </h4>
                                                </div>
                                            );
                                        }

                                        acc.push(
                                            <div key={item.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        {item.parentName && (
                                                            <span className="text-[11px] text-slate-400">
                                                                {item.parentName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Link
                                                        href={item.href}
                                                        className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                                                    >
                                                        {item.name}
                                                        <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                    </Link>
                                                </div>
                                                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono font-medium text-slate-600 dark:text-slate-400 uppercase">
                                                    {item.role.replace(/_/g, " ")}
                                                </div>
                                            </div>
                                        );
                                        return acc;
                                    }, [])}
                                </div>
                            )}
                        </CardContent>
                    </Card>


                </div>

                {/* Sidebar Area */}
                <div className="md:col-span-4 space-y-6">
                    {/* Personalization (Whimsy Mode) */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                <CardTitle>Personalization</CardTitle>
                            </div>
                            <CardDescription>Add a touch of magic to your workflow.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
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
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-amber-500" />
                                <CardTitle>Notifications</CardTitle>
                            </div>
                            <CardDescription>Control how and when you are alerted.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
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
