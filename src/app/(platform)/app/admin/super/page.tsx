"use client";

import { useEffect, useState } from "react";
import { getSystemStats, onboardClient } from "@/actions/super-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Building2, Briefcase, Landmark, Gavel, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { UserManagementWizard } from "@/components/super-admin/UserManagementWizard";

export default function SuperAdminPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Form State
    const [clientName, setClientName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [onboarding, setOnboarding] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        setLoading(true);
        const data = await getSystemStats();
        if (data) {
            setStats(data);
        } else {
            // Unauthorized or error
            toast.error("Unauthorized");
            router.push("/app");
        }
        setLoading(false);
    }

    async function handleOnboard() {
        if (!clientName || !adminEmail) {
            toast.error("Please fill in all fields");
            return;
        }

        setOnboarding(true);
        try {
            const res = await onboardClient({ name: clientName, adminEmail });
            if (res.success) {
                toast.success("Client Onboarded!");
                setClientName("");
                setAdminEmail("");
                loadStats(); // Refresh stats
            } else {
                toast.error(res.error);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to onboard");
        } finally {
            setOnboarding(false);
        }
    }

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!stats) return <div>Access Denied</div>;

    return (
        <div className="space-y-8 p-8 max-w-6xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
                <p className="text-muted-foreground">Manage the compass platform.</p>
            </div>

            {/* STATS */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clients</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.clientCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projects (LEs)</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.leCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.userCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suppliers (FI)</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.fiCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Law Firms</CardTitle>
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.lawFirmCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* USER MANAGEMENT WIZARD */}
            <UserManagementWizard />

            <div className="grid gap-8 md:grid-cols-2">
                {/* ONBOARD WIZARD */}
                <Card>
                    <CardHeader>
                        <CardTitle>Onboard New Client</CardTitle>
                        <CardDescription>Create a new Client Organization and invite an administrator.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="clientName">Client Name</Label>
                            <Input
                                id="clientName"
                                placeholder="e.g. MegaCorp Global"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminEmail">Admin Email</Label>
                            <Input
                                id="adminEmail"
                                placeholder="admin@megacorp.com"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                        </div>
                        <Button className="w-full" onClick={handleOnboard} disabled={onboarding}>
                            {onboarding ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                            Create Client
                        </Button>
                    </CardContent>
                </Card>

                {/* MORE ACTIONS placeholder */}
                <Card>
                    <CardHeader>
                        <CardTitle>Management Tools</CardTitle>
                        <CardDescription>Other system tasks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <a href="/app/admin/organizations?type=CLIENT">
                                <Building2 className="w-4 h-4 mr-2" /> Manage All Clients
                            </a>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <a href="/app/admin/users">
                                <Users className="w-4 h-4 mr-2" /> Manage All Users (List View)
                            </a>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" disabled>
                            <Landmark className="w-4 h-4 mr-2" /> Onboard Financial Institution (Coming Soon)
                        </Button>
                        <Button variant="outline" className="w-full justify-start" disabled>
                            <Gavel className="w-4 h-4 mr-2" /> Onboard Law Firm (Coming Soon)
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
