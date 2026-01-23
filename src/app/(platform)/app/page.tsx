"use client";

import { useEffect, useState } from "react";
import { getUserContexts, DashboardContexts } from "@/actions/dashboard";

import { GuideHeader } from "@/components/layout/GuideHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Briefcase, Landmark, Gavel, ArrowRight, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function V2DashboardPage() {
    const [contexts, setContexts] = useState<DashboardContexts | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getUserContexts();
                setContexts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);



    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!contexts) return <div>Failed to load context.</div>;

    return (
        <div className="space-y-8 p-8">
            <div className="flex items-center gap-2">
                <Home className="h-8 w-8 text-muted-foreground" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Universe</h1>
                    <p className="text-muted-foreground">Select a context to work in.</p>
                </div>
            </div>

            {/* 1. My Clients */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-xl font-semibold">My Clients</h2>
                </div>
                {contexts.clients.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic pl-7">No client access found.</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {contexts.clients.map(c => (
                            <Link href={`/app/clients/${c.id}`} key={c.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer border-indigo-100">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg">{c.name}</CardTitle>
                                            <Badge variant={c.source === "DIRECT" ? "default" : "secondary"}>
                                                {c.source === "DIRECT" ? (c.role === "ADMIN" ? "Admin" : "Member") : "Derived"}
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            {c.source === "DIRECT"
                                                ? "You have direct access to this Client."
                                                : "Access via Legal Entity membership."}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* 2. My Legal Entities */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-xl font-semibold">My Legal Entities (SPVs)</h2>
                </div>
                {contexts.legalEntities.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic pl-7">No active projects found.</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {contexts.legalEntities.map(le => (
                            <Link href={`/app/le/${le.id}`} key={le.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer border-emerald-100">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg">{le.name}</CardTitle>
                                            <Badge variant="outline">{le.role}</Badge>
                                        </div>
                                        <CardDescription className="flex items-center gap-1">
                                            Owned by <span className="font-medium text-foreground">{le.clientName}</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                                            <div>
                                                Enter Workspace <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* 2.5 My Relationships */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-xl font-semibold">My Relationships</h2>
                </div>
                {(!contexts.relationships || contexts.relationships.length === 0) ? (
                    <div className="text-sm text-muted-foreground italic pl-7">No active relationships found.</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {contexts.relationships.map(rel => (
                            <Link href={`#`} key={rel.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer border-indigo-100">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="text-lg leading-tight">{rel.leName} : {rel.supplierName}</CardTitle>
                                            <Badge variant="outline" className="shrink-0">{rel.status}</Badge>
                                        </div>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* 3. My Financial Institutions */}
            {contexts.financialInstitutions.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-blue-500" />
                        <h2 className="text-xl font-semibold">My Financial Institutions</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {contexts.financialInstitutions.map(fi => (
                            <Link href="/app/fi" key={fi.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100">
                                    <CardHeader>
                                        <CardTitle>{fi.name}</CardTitle>
                                        <CardDescription>{fi.role}</CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* 4. My Law Firms */}
            {/* 4. My Law Firms */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-purple-500" />
                    <h2 className="text-xl font-semibold">My Law Firms</h2>
                </div>
                {contexts.lawFirms.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic pl-7">No active Membership found.</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {contexts.lawFirms.map(lf => (
                            <Link href={`/app/admin/organizations/${lf.id}`} key={lf.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer border-purple-100">
                                    <CardHeader>
                                        <CardTitle>{lf.name}</CardTitle>
                                        <CardDescription>{lf.role}</CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
