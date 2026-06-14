"use client";

import React from "react";
import {
    isPersonOrContactValue,
    getPersonOrContactSummary,
    type PersonOrContactValue,
    type PersonOrContactRole,
} from "@/lib/master-data/person-or-contact-value";

interface PersonOrContactValueViewerProps {
    value: any;
    layout?: "compact" | "detailed";
}

// ── Role type badge colour ────────────────────────────────────────────────────
const ROLE_TYPE_COLOURS: Record<string, string> = {
    DIRECTOR:           'bg-indigo-50 text-indigo-700 border-indigo-100',
    PSC:                'bg-purple-50 text-purple-700 border-purple-100',
    SIGNATORY:          'bg-teal-50 text-teal-700 border-teal-100',
    MLRO:               'bg-amber-50 text-amber-700 border-amber-100',
    COMPLIANCE_OFFICER: 'bg-orange-50 text-orange-700 border-orange-100',
    BOARD_MEMBER:       'bg-blue-50 text-blue-700 border-blue-100',
    CONTACT:            'bg-slate-50 text-slate-700 border-slate-200',
    OTHER:              'bg-slate-50 text-slate-500 border-slate-200',
};

function RoleBadge({ roleType, roleTitle }: { roleType: string | null; roleTitle: string | null }) {
    const label   = roleType ?? roleTitle ?? 'Role';
    const colours = ROLE_TYPE_COLOURS[roleType ?? ''] ?? 'bg-slate-50 text-slate-500 border-slate-200';
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colours}`}>
            {label}
        </span>
    );
}

function StatusDot({ active }: { active: boolean | null }) {
    if (active === null) return null;
    return (
        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
    );
}

function Field({ label, value: v }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                {label}
            </span>
            <span className="text-slate-900 font-medium text-sm">
                {v ?? <span className="text-slate-400 italic">—</span>}
            </span>
        </div>
    );
}

function formatPartialDob(
    dob: { year: number | null; month: number | null; day: number | null } | null | undefined
): string | null {
    if (!dob) return null;
    const parts: string[] = [];
    
    if (dob.day) parts.push(String(dob.day));
    
    if (dob.month) {
        const date = new Date(2000, dob.month - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        parts.push(monthName);
    }
    
    if (dob.year) parts.push(String(dob.year));
    
    return parts.length > 0 ? parts.join(' ') : null;
}

function RoleRow({ role }: { role: PersonOrContactRole }) {
    const dateRange = [
        role.appointedOn ? `Appointed ${role.appointedOn}` : null,
        role.resignedOn  ? `Resigned ${role.resignedOn}`   : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="flex flex-col gap-1 py-2 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-2 flex-wrap">
                <StatusDot active={role.isActiveRole} />
                <RoleBadge roleType={role.roleType ?? null} roleTitle={role.roleTitle} />
                {role.roleTitle && role.roleType && (
                    <span className="text-xs text-slate-500">{role.roleTitle}</span>
                )}
            </div>
            {dateRange && (
                <span className="text-[11px] text-slate-400 ml-3.5">{dateRange}</span>
            )}
            {role.natureOfControl.length > 0 && (
                <div className="ml-3.5 mt-0.5 flex flex-wrap gap-1">
                    {role.natureOfControl.map((noc, i) => (
                        <span key={i} className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 rounded px-1.5 py-0.5">
                            {noc}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function PersonOrContactValueViewer({ value, layout = "compact" }: PersonOrContactValueViewerProps) {
    if (!isPersonOrContactValue(value)) {
        return <span className="text-slate-400 italic">—</span>;
    }

    const poc = value as PersonOrContactValue;

    if (layout === "compact") {
        const summary = getPersonOrContactSummary(poc);
        return (
            <span className="text-sm text-slate-900 font-medium">
                {summary || <span className="text-slate-400 italic">—</span>}
            </span>
        );
    }

    // ── Detailed layout ────────────────────────────────────────────────────────
    const dob = formatPartialDob(poc.dateOfBirth);

    return (
        <div className="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-sm font-sans mt-2 shadow-inner">

            {/* Header — name + type */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                        {poc.contactType}
                    </span>
                    <span className="text-base font-semibold text-slate-900">
                        {[poc.forenames, poc.surname].filter(Boolean).join(' ') || <span className="text-slate-400 italic">—</span>}
                    </span>
                    {poc.title && (
                        <span className="ml-2 text-xs text-slate-500">{poc.title}</span>
                    )}
                </div>
                {poc.isActivePersonOrContact !== null && (
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-1 border ${poc.isActivePersonOrContact ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {poc.isActivePersonOrContact ? 'Active' : 'Inactive'}
                    </span>
                )}
            </div>

            {/* Name breakdown */}
            {(poc.forenames || poc.surname) && (
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    <Field label="Forenames" value={poc.forenames} />
                    <Field label="Surname"   value={poc.surname} />
                </div>
            )}

            {/* Contact info */}
            {(poc.email || poc.phones.length > 0) && (
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    {poc.email && <Field label="Email" value={poc.email} />}
                    {poc.phones.map((p, i) => (
                        <Field key={i} label={p.type} value={p.number} />
                    ))}
                </div>
            )}

            {/* Individual attributes */}
            {(poc.nationality.length > 0 || poc.countryOfResidence || dob || poc.placeOfBirth) && (
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                    {poc.nationality.length > 0 && (
                        <Field label="Nationality" value={poc.nationality.join(', ')} />
                    )}
                    {poc.countryOfResidence && (
                        <Field label="Country of Residence" value={poc.countryOfResidence} />
                    )}
                    {dob && <Field label="Date of Birth" value={dob} />}
                    {poc.placeOfBirth && <Field label="Place of Birth" value={poc.placeOfBirth} />}
                </div>
            )}

            {/* Roles */}
            {poc.roles.length > 0 && (
                <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Roles
                    </span>
                    <div className="divide-y divide-slate-100">
                        {poc.roles.map((role, i) => (
                            <RoleRow key={i} role={role} />
                        ))}
                    </div>
                </div>
            )}

            {/* Source identifiers */}
            {poc.sourceIdentifiers.length > 0 && (
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Source Identifiers
                    </span>
                    <div className="flex flex-col gap-1">
                        {poc.sourceIdentifiers.map((si, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-mono">{si.scheme}</span>
                                <span className="text-slate-700">{si.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
