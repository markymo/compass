"use client";

import { useEffect, useState } from "react";
import { getAccountSettings, updateAccountSettings } from "@/actions/account";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, User, Bell } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
        fetchSettings();
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

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app" },
                    { label: "Account Settings" }
                ]}
            />

            <div className="grid gap-6 md:grid-cols-12">
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

                </div>

                {/* Sidebar Area */}
                <div className="md:col-span-4 space-y-6">
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
    );
}
