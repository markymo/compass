import { getIdentity } from "@/lib/auth";
import { checkIsSystemAdmin } from "@/actions/client";
import { redirect } from "next/navigation";
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    Building2,
    Briefcase,
    FileCheck2,
    Users,
    KeyRound,
    Lock,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Info,
    History,
    Sparkles,
    GitBranch,
    Scale,
    Layers,
    FileText,
    ArrowDownRight,
    ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTION_DOCUMENTATION, ACTION_MATRIX_ROWS } from "./action-descriptions";

export default async function PermissionsReferencePage() {
    const identity = await getIdentity();
    if (!identity?.userId) redirect("/login");

    const isSysAdmin = await checkIsSystemAdmin(identity.userId);
    if (!isSysAdmin) redirect("/app");

    return (
        <div className="space-y-12 pb-16 max-w-7xl">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-white">
                                Permissions Model
                            </h1>
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-mono text-xs py-0.5">
                                Internal • System Admin only
                            </Badge>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base max-w-3xl">
                            How OnPro separates platform administration, organisation administration, and operational customer access.
                        </p>
                    </div>
                </div>
            </div>

            {/* Section 1: Top-Level Principle */}
            <section className="space-y-6">
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/10 p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-blue-600 text-white shrink-0 shadow-sm">
                            <Scale className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <span className="text-xs font-bold tracking-wider uppercase text-blue-700 dark:text-blue-400">
                                Core Architectural Principle
                            </span>
                            <blockquote className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                                “Administrative roles administer accounts and platform structure. Operational roles grant access to customer data.”
                            </blockquote>
                            <p className="text-sm text-slate-600 dark:text-slate-400 pt-1">
                                Platform administration and customer-data access are completely segregated. Holding an administrative or system privilege does not grant automatic access to customer legal entity dossiers, relationship responses, or private documents.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Role Hierarchy Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* System */}
                    <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/10">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 font-mono">
                                    Platform Scope
                                </span>
                                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                SYSTEM_ADMIN
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Platform administration only</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>No customer operational data</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organisation */}
                    <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-mono">
                                    Organisation Scope
                                </span>
                                <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                ORG_ADMIN / ORG_MEMBER
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Account & structure management</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                <span>Capabilities keyed to Org.types</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>No operational data</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Client Operational */}
                    <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono">
                                    Client Operational Scope
                                </span>
                                <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                LE_ADMIN / LE_USER
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Explicit ClientLE membership</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Master Data operational access</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                                <span>Cascades client-side to relationships</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Supplier Operational */}
                    <Card className="border-teal-200 dark:border-teal-900/40 bg-teal-50/30 dark:bg-teal-950/10">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 font-mono">
                                    Supplier Operational Scope
                                </span>
                                <FileCheck2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                            </div>
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                RELATIONSHIP_ADMIN / USER
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Explicit relationship membership</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Relationship-scoped operational work</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>No cross-engagement access</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 2: Security Scope Diagram & Current Security Rules */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Visual Security Boundaries Diagram */}
                <Card className="lg:col-span-6 border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                            <CardTitle className="text-base font-bold">Security Scope Hierarchy</CardTitle>
                        </div>
                        <CardDescription>
                            Visual model of account administration boundaries vs operational data boundaries.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 font-mono text-xs">
                            {/* System Level */}
                            <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
                                <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-300">
                                    <span className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-purple-600" />
                                        SYSTEM_ADMIN
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-purple-100/80 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300">
                                        Platform Only
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-purple-700 dark:text-purple-400 font-sans mt-1">
                                    Administers platform schemas, tenants, telemetry, and un-deletion. No customer data.
                                </p>
                            </div>

                            {/* Org Level */}
                            <div className="ml-4 p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                                <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300">
                                    <span className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-amber-600" />
                                        Organization: ORG_ADMIN / ORG_MEMBER
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300">
                                        Tenant Admin
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-sans mt-1">
                                    Administers commercial team & billing; provisions ClientLEs (Client org) or template library (Supplier org).
                                </p>
                            </div>

                            {/* ClientLE Level */}
                            <div className="ml-8 p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
                                <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-300">
                                    <span className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-blue-600" />
                                        ClientLE: LE_ADMIN / LE_USER
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300">
                                        Client Operational Boundary
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-blue-700 dark:text-blue-400 font-sans mt-1">
                                    Direct operational control of Master Data; cascades client-side into all relationships beneath this ClientLE.
                                </p>

                                {/* Downward cascade to relationships */}
                                <div className="mt-2.5 pt-2.5 border-t border-blue-200/60 dark:border-blue-800/40 flex items-center gap-2 text-[11px] text-blue-800 dark:text-blue-300 font-sans">
                                    <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                                    <span>Client-side operational access automatically inherits to all child relationships</span>
                                </div>
                            </div>

                            {/* Relationship Level */}
                            <div className="ml-12 p-3.5 rounded-lg border border-teal-200 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-950/20">
                                <div className="flex items-center justify-between font-bold text-teal-900 dark:text-teal-300">
                                    <span className="flex items-center gap-2">
                                        <FileCheck2 className="h-4 w-4 text-teal-600" />
                                        Relationship: RELATIONSHIP_ADMIN / USER
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-teal-100/80 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300">
                                        Supplier Operational Boundary
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-teal-700 dark:text-teal-400 font-sans mt-1">
                                    Supplier-side operational lead/worker scoped strictly to this specific engagement relationship.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Important Current Security Rules */}
                <Card className="lg:col-span-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <CardTitle className="text-base font-bold">Current Security Rules</CardTitle>
                        </div>
                        <CardDescription>
                            Authoritative invariants enforced by the central authorization engine.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Organisation administration does not imply customer operational access:</strong> Holding <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">ORG_ADMIN</code> grants no access to Master Data or live engagement questionnaires.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>ClientLE is the Client operational security boundary:</strong> Client operational roles are bound directly to individual ClientLE records, not top-level organisation accounts.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>LE roles inherit downward into child relationships:</strong> ClientLE membership grants client-side response and sign-off access to all relationships under that ClientLE.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Supplier operational access requires explicit Relationship membership:</strong> Supplier users must be directly assigned to an engagement (<code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">RELATIONSHIP_ADMIN</code> or <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">RELATIONSHIP_USER</code>).
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Platform administration does not imply customer operational access:</strong> Pure <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">SYSTEM_ADMIN</code> has no access to customer KYC data, live relationships, or private customer documents.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Platform-owned questionnaires require positive SYSTEM ownership:</strong> Questionnaires are platform assets only if an associated organisation has <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">types: ["SYSTEM"]</code>.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Billing administration is organisation-level:</strong> Managed via <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">ORG_MANAGE_BILLING</code> without requiring operational LE access.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Master Field Assignments require ClientLE authorization:</strong> Mapping custom fields to canonical master data requires explicit <code className="text-[11px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">LE_EDIT_MASTER_DATA</code>.
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </section>

            {/* Section 3: Current Implementation */}
            <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-2xl font-bold tracking-tight font-serif text-slate-900 dark:text-white">
                                Current implementation
                            </h2>
                            <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-mono text-xs">
                                Source of truth: active authorization code
                            </Badge>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Reconstructed directly from <code className="text-xs font-mono">src/lib/auth/permissions.ts</code> and active server action guards.
                        </p>
                    </div>
                </div>

                {/* Current Role Matrix Table */}
                <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                            <TableRow>
                                <TableHead className="w-[180px] font-bold">Role</TableHead>
                                <TableHead className="w-[140px] font-bold">Scope</TableHead>
                                <TableHead className="font-bold">Administration</TableHead>
                                <TableHead className="font-bold">Operational Access</TableHead>
                                <TableHead className="font-bold">Inheritance & Cascade</TableHead>
                                <TableHead className="font-bold">Key Restrictions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            {/* SYSTEM_ADMIN */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-purple-700 dark:text-purple-400">
                                    SYSTEM_ADMIN
                                </TableCell>
                                <TableCell>Platform</TableCell>
                                <TableCell>
                                    Platform schemas, reference library, tenant onboarding, telemetry, restore, hard-delete
                                </TableCell>
                                <TableCell className="text-red-600 dark:text-red-400 font-medium">
                                    None (No customer data access)
                                </TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Cannot view/edit ClientLE data, live relationships, or private customer documents
                                </TableCell>
                            </TableRow>

                            {/* ORG_ADMIN */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                    ORG_ADMIN
                                </TableCell>
                                <TableCell>Organisation</TableCell>
                                <TableCell>
                                    Team management, billing, plus type-gated admin: ClientLE provisioning (<code className="font-mono text-[10px]">CLIENT</code>) or Questionnaire library (<code className="font-mono text-[10px]">SUPPLIER</code>)
                                </TableCell>
                                <TableCell className="text-red-600 dark:text-red-400 font-medium">
                                    None (Account structure only)
                                </TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Capabilities strictly gated by <code className="font-mono text-[10px]">Organization.types</code>; no operational KYC access
                                </TableCell>
                            </TableRow>

                            {/* ORG_MEMBER */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-slate-700 dark:text-slate-400">
                                    ORG_MEMBER
                                </TableCell>
                                <TableCell>Organisation</TableCell>
                                <TableCell className="text-slate-500">None (Base association)</TableCell>
                                <TableCell className="text-red-600 dark:text-red-400 font-medium">None</TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Base membership only; cannot access dossiers or relationships without explicit assignment
                                </TableCell>
                            </TableRow>

                            {/* LE_ADMIN */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-blue-700 dark:text-blue-400">
                                    LE_ADMIN
                                </TableCell>
                                <TableCell>ClientLE</TableCell>
                                <TableCell>
                                    ClientLE updates, user management, relationship workspace creation/archival
                                </TableCell>
                                <TableCell className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Full Master Data (View, Edit, Sign-off)
                                </TableCell>
                                <TableCell className="text-blue-700 dark:text-blue-400 font-medium">
                                    Cascades client-side to all relationships beneath this ClientLE
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Operational scope bounded strictly to assigned ClientLE and its child relationships
                                </TableCell>
                            </TableRow>

                            {/* LE_USER */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                    LE_USER
                                </TableCell>
                                <TableCell>ClientLE</TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Master Data (View, Edit)
                                </TableCell>
                                <TableCell className="text-blue-700 dark:text-blue-400 font-medium">
                                    Cascades client-side to all relationships beneath this ClientLE
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    No Master Data sign-off capability; no user administration
                                </TableCell>
                            </TableRow>

                            {/* RELATIONSHIP_ADMIN */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-teal-700 dark:text-teal-400">
                                    RELATIONSHIP_ADMIN
                                </TableCell>
                                <TableCell>Relationship</TableCell>
                                <TableCell>Relationship user management</TableCell>
                                <TableCell className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Released Data view, Draft Responses edit, Response Sign-off
                                </TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Operational scope bounded strictly to this single engagement relationship
                                </TableCell>
                            </TableRow>

                            {/* RELATIONSHIP_USER */}
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <TableCell className="font-mono font-bold text-teal-600 dark:text-teal-400">
                                    RELATIONSHIP_USER
                                </TableCell>
                                <TableCell>Relationship</TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Released Data view, Draft Responses edit
                                </TableCell>
                                <TableCell className="text-slate-500">None</TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    No response sign-off capability; no relationship user management
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Card>

                {/* Deep-Dive Role Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SYSTEM_ADMIN Details */}
                    <Card className="border-purple-200 dark:border-purple-900/50">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-purple-600" />
                                <CardTitle className="text-base font-bold font-mono text-purple-900 dark:text-purple-300">
                                    SYSTEM_ADMIN Deep Dive
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <p className="text-slate-600 dark:text-slate-400">
                                Explicit privilege role governing the OnPro platform infrastructure. Exercises 5 explicit platform actions:
                            </p>
                            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg font-mono space-y-1 text-[11px] text-slate-800 dark:text-slate-200">
                                <div>• <strong>SYSTEM_MANAGE_PLATFORM</strong>: Schema definitions, AI mapping, Reference Library</div>
                                <div>• <strong>SYSTEM_MANAGE_TENANTS</strong>: Tenant onboarding & cross-tenant account setup</div>
                                <div>• <strong>SYSTEM_VIEW_TELEMETRY</strong>: Pulse, logs, ecosystem metrics, aggregate statistics</div>
                                <div>• <strong>SYSTEM_RESTORE</strong>: Un-delete soft-deleted ClientLE dossiers</div>
                                <div>• <strong>SYSTEM_HARD_DELETE</strong>: Irreversible permanent purge of dossiers/empty orgs</div>
                            </div>
                            <div className="p-2.5 rounded border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-300 font-medium">
                                ✗ Strictly denies automatic access to customer KYC Master Data, live relationships, tenant reusable questionnaires, and customer output packs.
                            </div>
                        </CardContent>
                    </Card>

                    {/* ORG_ADMIN Details */}
                    <Card className="border-amber-200 dark:border-amber-900/50">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-amber-600" />
                                <CardTitle className="text-base font-bold font-mono text-amber-900 dark:text-amber-300">
                                    ORG_ADMIN Deep Dive
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <p className="text-slate-600 dark:text-slate-400">
                                Single unified organisation administrator replacing the legacy Client Admin / FI Admin split:
                            </p>
                            <div className="space-y-2 text-slate-700 dark:text-slate-300">
                                <div>
                                    <strong>Common Capabilities:</strong> <code className="font-mono text-[10px]">ORG_MANAGE_TEAM</code> (invite members) and <code className="font-mono text-[10px]">ORG_MANAGE_BILLING</code> (manage subscription/invoices).
                                </div>
                                <div>
                                    <strong>CLIENT Organization:</strong> Allows ClientLE creation (<code className="font-mono text-[10px]">LE_CREATE</code>), renaming, archiving, and break-glass self-join (<code className="font-mono text-[10px]">ORG_SELF_JOIN_LE</code>).
                                </div>
                                <div>
                                    <strong>SUPPLIER Organization:</strong> Allows questionnaire library management (<code className="font-mono text-[10px]">QUESTIONNAIRE_CREATE/UPDATE/DELETE</code>).
                                </div>
                                <div>
                                    <strong>Multi-Type [CLIENT, SUPPLIER]:</strong> Receives both administrative capability sets under the same single <code className="font-mono text-[10px]">ORG_ADMIN</code> role.
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 4: Technical Action Matrix */}
            <section className="space-y-4">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-bold font-serif text-slate-900 dark:text-white">
                                Technical action matrix
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Exact mapping between internal Action enums and active Role definitions. Click any action name (▸) to expand its plain-English description and security boundaries.
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50 text-[11px]">
                            <TableRow>
                                <TableHead className="font-bold min-w-[280px]">Action Enum & Scope</TableHead>
                                <TableHead className="text-center font-bold text-purple-700 dark:text-purple-400 font-mono">SYS_ADMIN</TableHead>
                                <TableHead className="text-center font-bold text-amber-700 dark:text-amber-400 font-mono">ORG_ADMIN</TableHead>
                                <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400 font-mono">ORG_MEMBER</TableHead>
                                <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400 font-mono">LE_ADMIN</TableHead>
                                <TableHead className="text-center font-bold text-blue-600 dark:text-blue-400 font-mono">LE_USER</TableHead>
                                <TableHead className="text-center font-bold text-teal-700 dark:text-teal-400 font-mono">REL_ADMIN</TableHead>
                                <TableHead className="text-center font-bold text-teal-600 dark:text-teal-400 font-mono">REL_USER</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            {ACTION_MATRIX_ROWS.map((row) => {
                                const doc = ACTION_DOCUMENTATION[row.action];
                                return (
                                    <TableRow key={row.action} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                        <TableCell className="py-2.5 font-sans min-w-[280px] align-top">
                                            <details className="group">
                                                <summary className="list-none cursor-pointer flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 select-none py-0.5">
                                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
                                                    <span>{row.action}</span>
                                                </summary>
                                                <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold text-slate-900 dark:text-white font-sans">{doc.name}</span>
                                                        <Badge variant="outline" className="text-[10px] py-0 font-mono">{doc.scope}</Badge>
                                                    </div>
                                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-sans">{doc.description}</p>
                                                    {doc.restrictions && (
                                                        <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60 dark:border-slate-800/60 font-sans">
                                                            <strong>Boundary:</strong> {doc.restrictions}
                                                        </p>
                                                    )}
                                                </div>
                                            </details>
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.sysAdmin === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.sysAdmin}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.orgAdmin === '✓' ? 'text-emerald-600' : row.orgAdmin === '—' ? 'text-slate-400' : 'text-amber-600 text-[11px]'}`}>
                                            {row.orgAdmin}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.orgMember === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.orgMember}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.leAdmin === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.leAdmin}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.leUser === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.leUser}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.relAdmin === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.relAdmin}
                                        </TableCell>
                                        <TableCell className={`text-center font-mono font-bold align-top py-3 ${row.relUser === '✓' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {row.relUser}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
                <p className="text-[11px] text-slate-500 italic">
                    * RELATIONSHIP_ADMIN possesses <code className="font-mono text-[10px]">questionnaire:update</code> for modifying engagement-scoped questionnaire responses within its assigned relationship.
                </p>
            </section>

            {/* Section 5: January 2026 Specification */}
            <section className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold tracking-tight font-serif text-slate-900 dark:text-white">
                            January 2026 specification
                        </h2>
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-mono text-xs">
                            Historical specification
                        </Badge>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Historical design captured in <code className="text-xs font-mono">docs/CompassUserPermissions.ods</code> on 25 January 2026.
                    </p>
                </div>

                {/* January Historical Table */}
                <Card className="border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50 text-[11px]">
                            <TableRow>
                                <TableHead className="w-[180px] font-bold">Functional Area</TableHead>
                                <TableHead className="font-bold font-mono">System Admin</TableHead>
                                <TableHead className="font-bold font-mono">Client Admin</TableHead>
                                <TableHead className="font-bold font-mono">LE Admin</TableHead>
                                <TableHead className="font-bold font-mono">LE User</TableHead>
                                <TableHead className="font-bold font-mono">FI Admin</TableHead>
                                <TableHead className="font-bold font-mono">FI Relationship Admin</TableHead>
                                <TableHead className="font-bold font-mono">FI Relationship User</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            <TableRow>
                                <TableCell className="font-semibold">Master Schema & System Questionnaires</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-600">Read only (Questionnaires)</TableCell>
                                <TableCell className="text-slate-600">Read only</TableCell>
                                <TableCell className="text-slate-600">Read only</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">Client Org & Admin Users</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">Client LE Dossiers & LE Users</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Edit / delete / manage</TableCell>
                                <TableCell className="text-slate-600">Read only / assign tasks</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-600">View within relationship</TableCell>
                                <TableCell className="text-slate-600">View within relationship</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">FI / Law Firm Org & Admin Users</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                                <TableCell className="text-slate-600">View high level data</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">Relationship Invitations</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Send</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Send</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Accept / decline / reassign</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">FI Questionnaire Library</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-600">When assigned</TableCell>
                                <TableCell className="text-slate-600">When assigned</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Create / edit / delete</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-semibold">Questionnaire Responses</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Read / write</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Read / write</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-600">Read only</TableCell>
                                <TableCell className="text-slate-600">Read only</TableCell>
                            </TableRow>
                            <TableRow className="bg-amber-50/20 dark:bg-amber-950/10">
                                <TableCell className="font-semibold text-amber-900 dark:text-amber-300">Questionnaire Response Sign-Off</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Read / write</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                            </TableRow>
                            <TableRow className="bg-teal-50/20 dark:bg-teal-950/10">
                                <TableCell className="font-semibold text-teal-900 dark:text-teal-300">Process Completion Sign-Off</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                                <TableCell className="text-slate-400">No access</TableCell>
                                <TableCell className="text-emerald-700 font-medium">Read / write</TableCell>
                                <TableCell className="text-slate-400">Read only</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Card>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Historical Sign-Off Distinction in January 2026:
                    </p>
                    <p>
                        The January specification distinctly separated <strong>Questionnaire Response Sign-Off</strong> (the Client operational lead validating KYC answers) from <strong>Process Completion Sign-Off</strong> (the Supplier operational lead formally closing and accepting the engagement process).
                    </p>
                </div>
            </section>

            {/* Section 6: What Changed? How the Model Evolved */}
            <section className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold tracking-tight font-serif text-slate-900 dark:text-white">
                            How the model evolved
                        </h2>
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 font-mono text-xs">
                            Evolution & Rationale
                        </Badge>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Architectural transitions between the January 2026 specification and the current OnPro implementation.
                    </p>
                </div>

                {/* Evolution Comparison Table */}
                <Card className="border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50 text-[11px]">
                            <TableRow>
                                <TableHead className="w-[200px] font-bold">Concept</TableHead>
                                <TableHead className="w-[240px] font-bold font-mono">January 2026 Model</TableHead>
                                <TableHead className="w-[260px] font-bold font-mono text-blue-700 dark:text-blue-400">Current OnPro Implementation</TableHead>
                                <TableHead className="font-bold">Architectural Rationale</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            <TableRow>
                                <TableCell className="font-semibold">Client Admin</TableCell>
                                <TableCell className="font-mono text-slate-600">Client Admin</TableCell>
                                <TableCell className="font-mono font-medium text-amber-700 dark:text-amber-400">
                                    ORG_ADMIN + types: ["CLIENT"]
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Same account-administration principle. Consolidated into generic <code className="font-mono text-[10px]">ORG_ADMIN</code> with capability gating based on organisation types.
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">FI Admin</TableCell>
                                <TableCell className="font-mono text-slate-600">FI Admin</TableCell>
                                <TableCell className="font-mono font-medium text-amber-700 dark:text-amber-400">
                                    ORG_ADMIN + types: ["SUPPLIER", "FI"]
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Old FI/Supplier administrator collapsed into generic <code className="font-mono text-[10px]">ORG_ADMIN</code>. Supplier template library capabilities derive from organisation type rather than a distinct role.
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">System Admin</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                    Platform admin with strictly limited customer data access
                                </TableCell>
                                <TableCell className="font-mono font-medium text-purple-700 dark:text-purple-400">
                                    SYSTEM_ADMIN (5 explicit SYSTEM_* actions)
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Restored original January principle. Eliminated wildcard <code className="font-mono text-[10px]">["*"]</code> god mode; explicit platform actions enforce customer data denial.
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">LE Relationship Access</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                    Assignment-dependent relationship access
                                </TableCell>
                                <TableCell className="font-mono font-medium text-blue-700 dark:text-blue-400">
                                    ClientLE membership cascades to all relationships
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Intentional product decision: ClientLE is the authoritative operational boundary for clients, so LE members automatically manage relationships under that ClientLE.
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">Supplier Relationship Roles</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                    FI Relationship Admin / User
                                </TableCell>
                                <TableCell className="font-mono font-medium text-teal-700 dark:text-teal-400">
                                    RELATIONSHIP_ADMIN / RELATIONSHIP_USER
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Generalisation across all supplier/vendor counterparty types (FIs, Law Firms, Corporate Suppliers).
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">Sign-off Model</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                    Distinct Response Sign-off vs Process Completion Sign-off
                                </TableCell>
                                <TableCell className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                    LE_SIGNOFF_MASTER_DATA & ENG_SIGNOFF_RESPONSES
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    ClientLE Master Data sign-off separated from Relationship response sign-off to support independent workflow checkpoints.
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell className="font-semibold">Base Member Association</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                    No equivalent primary persona
                                </TableCell>
                                <TableCell className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    ORG_MEMBER
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                    Introduced to represent basic organisation affiliation with zero implicit operational or administrative permissions.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Card>
            </section>

            {/* Section 7: Sources & Security Checkpoints */}
            <section className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Documentation Sources & Checkpoint Commits</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">Historical Specification Source:</span>
                            <code className="font-mono text-[11px] bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 block">
                                docs/CompassUserPermissions.ods (25 January 2026)
                            </code>
                        </div>
                        <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">Active Implementation Source:</span>
                            <code className="font-mono text-[11px] bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 block">
                                src/lib/auth/permissions.ts & associated server actions
                            </code>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-mono">
                        <span>Checkpoints:</span>
                        <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            f441e83c — Generic ORG_ADMIN consolidation & organisation-type gating
                        </span>
                        <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            7f31e8ba — SYSTEM_ADMIN platform-only security boundary & god-mode removal
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
}
