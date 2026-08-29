"use client";

import React from "react";
import { Paperclip, FileText, Loader2, CheckCircle2, Database, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SaveForReuseHandler } from "@/lib/master-data/field-display-model";
import {
    isPersonOrContactValue,
    getPersonOrContactSummary,
    isFieldPermittedByMask,
    type PersonOrContactValue,
    type PersonOrContactRole,
    getPartyDisplayProjection,
    formatPartialDob,
    getIdentityVerificationLabel
} from "@/lib/master-data/person-or-contact-value";
import { getAddressSummary } from "@/lib/master-data/address-value";

interface PersonOrContactValueViewerProps {
    value: any;
    layout?: "compact" | "detailed" | "row";
    displayMask?: string[];
    partyLabel?: string;
    attachments?: import("@/lib/master-data/field-display-model").ResolvedAttachment[];
    claimId?: string;
    isPromotedToCCC?: boolean;
    isPromoting?: boolean;
    onSaveForReuse?: SaveForReuseHandler;
    hideStatusBadge?: boolean;
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
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                {label}
            </span>
            <span className="text-foreground font-medium text-sm">
                {v ?? <span className="text-muted-foreground italic">—</span>}
            </span>
        </div>
    );
}


function RoleRow({ role, displayMask, index = 0 }: { role: PersonOrContactRole, displayMask?: string[], index?: number }) {
    const showRoleField = (key: string) => isFieldPermittedByMask(`roles[${index}].${key}`, displayMask);

    const isPscRole = role.roleType === 'PSC' ||
        String(role.roleTitle || '').toLowerCase().includes('person-with-significant-control') ||
        String(role.roleTitle || '').toLowerCase().includes('person with significant control') ||
        (Array.isArray(role.natureOfControl) && role.natureOfControl.length > 0);

    const appointedLabel = isPscRole ? 'Notified' : 'Appointed';
    const resignedLabel  = isPscRole ? 'Ceased'   : 'Resigned';

    const dateRange = [
        showRoleField('appointedOn') && role.appointedOn ? `${appointedLabel} ${role.appointedOn}` : null,
        showRoleField('resignedOn') && role.resignedOn  ? `${resignedLabel} ${role.resignedOn}`   : null,
    ].filter(Boolean).join(' · ');

    const ivLabel = getIdentityVerificationLabel(role.identityVerification);

    return (
        <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2 flex-wrap">
                {showRoleField('isActiveRole') && <StatusDot active={role.isActiveRole} />}
                {(showRoleField('roleType') || showRoleField('roleTitle')) && (
                    <RoleBadge 
                        roleType={showRoleField('roleType') ? (role.roleType ?? null) : null} 
                        roleTitle={showRoleField('roleTitle') ? role.roleTitle : null} 
                    />
                )}
                {showRoleField('roleTitle') && showRoleField('roleType') && role.roleTitle && role.roleType && (
                    <span className="text-xs text-muted-foreground">{role.roleTitle}</span>
                )}
            </div>
            {dateRange && (
                <span className="text-[11px] text-muted-foreground ml-3.5">{dateRange}</span>
            )}
            {ivLabel && (
                <span className="text-[11px] text-muted-foreground font-medium ml-3.5">{ivLabel}</span>
            )}
            {showRoleField('natureOfControl') && role.natureOfControl?.length > 0 && (
                <div className="ml-3.5 mt-0.5 flex flex-wrap gap-1">
                    {role.natureOfControl.map((noc, i) => (
                        <span key={i} className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800 rounded px-1.5 py-0.5">
                            {formatNatureOfControl(noc)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

const NOC_LABELS: Record<string, string> = {
    'ownership-of-shares-25-to-50-percent': 'Ownership of shares — 25% to 50%',
    'ownership-of-shares-50-to-75-percent': 'Ownership of shares — 50% to 75%',
    'ownership-of-shares-75-to-100-percent': 'Ownership of shares — 75% or more',
    'voting-rights-25-to-50-percent': 'Ownership of voting rights — 25% to 50%',
    'voting-rights-50-to-75-percent': 'Ownership of voting rights — 50% to 75%',
    'voting-rights-75-to-100-percent': 'Ownership of voting rights — 75% or more',
    'right-to-appoint-and-remove-directors': 'Right to appoint or remove directors',
    'right-to-appoint-and-remove-personnel': 'Right to appoint or remove personnel',
    'significant-influence-or-control': 'Significant influence or control',
    'ownership-of-shares-75-to-100-percent-as-trust': 'Ownership of shares — 75% or more (as trust)',
    'ownership-of-shares-75-to-100-percent-as-firm': 'Ownership of shares — 75% or more (as firm)',
    'voting-rights-75-to-100-percent-as-trust': 'Ownership of voting rights — 75% or more (as trust)',
    'voting-rights-75-to-100-percent-as-firm': 'Ownership of voting rights — 75% or more (as firm)',
    'right-to-appoint-and-remove-directors-as-trust': 'Right to appoint or remove directors (as trust)',
    'right-to-appoint-and-remove-directors-as-firm': 'Right to appoint or remove directors (as firm)',
    'significant-influence-or-control-as-trust': 'Significant influence or control (as trust)',
    'significant-influence-or-control-as-firm': 'Significant influence or control (as firm)',
};

export function formatNatureOfControl(noc: string): string {
    if (!noc) return '';
    const clean = noc.trim();
    if (NOC_LABELS[clean]) return NOC_LABELS[clean];

    let label = clean
        .replace(/-as-(trust|firm)/, ' (as $1)')
        .replace(/ownership-of-shares-75-to-100-percent/, 'Ownership of shares — 75% or more')
        .replace(/voting-rights-75-to-100-percent/, 'Ownership of voting rights — 75% or more')
        .replace(/right-to-appoint-and-remove-directors/, 'Right to appoint or remove directors')
        .replace(/-/g, ' ');

    return label.charAt(0).toUpperCase() + label.slice(1);
}

function PartyAttachmentIndicator({ attachments, partyName }: { attachments: import("@/lib/master-data/field-display-model").ResolvedAttachment[]; partyName: string }) {
    if (!attachments || attachments.length === 0) return null;

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div 
                        className="inline-flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-secondary-foreground px-2 py-0.5 rounded text-xs font-medium shrink-0 cursor-pointer transition-colors border border-border"
                        aria-label={`${attachments.length} document${attachments.length === 1 ? '' : 's'} attached to ${partyName}`}
                    >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{attachments.length} doc{attachments.length === 1 ? '' : 's'}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs bg-card text-card-foreground border-border p-3 max-w-sm shadow-xl z-50">
                    <div className="font-semibold mb-2 text-[11px] text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
                        <span>{attachments.length === 1 ? 'Party Document' : `${attachments.length} Party Documents`}</span>
                    </div>
                    <ul className="space-y-2">
                        {attachments.map(att => (
                            <li key={att.documentId} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/50 border border-border">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate text-xs text-foreground font-medium">{att.displayName}</span>
                                </div>
                                <a
                                    href={`/api/documents/${att.documentId}/download`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-semibold shrink-0"
                                    title="Download document"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Download className="w-3 h-3" />
                                    Download
                                </a>
                            </li>
                        ))}
                    </ul>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function PersonOrContactValueViewer({
    value,
    layout = "compact",
    displayMask,
    partyLabel,
    attachments,
    claimId,
    isPromotedToCCC,
    isPromoting,
    onSaveForReuse,
    hideStatusBadge = false
}: PersonOrContactValueViewerProps) {
    if (!isPersonOrContactValue(value)) {
        if (value && typeof value === 'object' && 'ccPartyId' in value) {
            return <span className="text-muted-foreground italic">Unresolved Party</span>;
        }
        return <span className="text-muted-foreground italic">—</span>;
    }

    const poc = value as PersonOrContactValue;

    const renderActionButton = () => {
        if (isPromotedToCCC) {
            return (
                <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 ml-2 hover:bg-emerald-50 font-medium h-6 shrink-0" title="A reusable copy already exists for this item.">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Saved for reuse
                </Badge>
            );
        }
        if (onSaveForReuse && claimId) {
            return (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 dark:border-indigo-800 shrink-0 ml-2"
                    disabled={isPromoting}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSaveForReuse({ kind: 'EMBEDDED_PARTY', claimId, party: poc });
                    }}
                    title="Save this party to your dossier library for reuse across other fields and questionnaires."
                >
                    {isPromoting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Database className="w-3 h-3 mr-1" />}
                    Save for reuse
                </Button>
            );
        }
        return null;
    };

    if (layout === "compact") {
        const summary = partyLabel || getPersonOrContactSummary(poc);
        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground font-medium">
                {summary || <span className="text-muted-foreground italic">—</span>}
                {attachments && attachments.length > 0 && (
                    <PartyAttachmentIndicator attachments={attachments} partyName={summary || 'Party'} />
                )}
                {renderActionButton()}
            </span>
        );
    }

    const proj = getPartyDisplayProjection(poc, displayMask, partyLabel);
    const dob = formatPartialDob(poc.dateOfBirth, displayMask);
    const showField = (key: string) => isFieldPermittedByMask(key, displayMask);
    const primaryText = proj.primaryText;

    if (layout === "row") {
        return (
            <div className="flex items-center justify-between min-w-0 w-full">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                            {proj.primaryText}
                        </span>
                        {attachments && attachments.length > 0 && (
                            <PartyAttachmentIndicator attachments={attachments} partyName={proj.primaryText || 'Party'} />
                        )}
                    </div>
                    {proj.secondaryParts.length > 0 && (
                        <span className="text-xs text-muted-foreground whitespace-normal break-words mt-0.5">
                            {proj.secondaryParts.join(' · ')}
                        </span>
                    )}
                    {proj.addressText && (
                        <span className="text-[11px] text-muted-foreground whitespace-normal break-words mt-0.5">
                            {proj.addressText}
                        </span>
                    )}
                </div>
                {renderActionButton()}
            </div>
        );
    }

    // ── Detailed layout ────────────────────────────────────────────────────────

    return (
        <div className="grid grid-cols-1 gap-4 bg-muted/40 p-4 rounded-xl border border-border text-sm font-sans mt-2 shadow-inner">

            {/* Header — name + type */}
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                        {poc.contactType}
                    </span>
                    {(() => {
                        if (!primaryText) {
                            return <span className="text-base font-semibold text-muted-foreground italic">No displayable name</span>;
                        }
                        return (
                            <span className="text-base font-semibold text-foreground">
                                {primaryText}
                            </span>
                        );
                    })()}
                </div>
                <div className="flex items-center gap-2">
                    {attachments && attachments.length > 0 && (
                        <PartyAttachmentIndicator attachments={attachments} partyName={primaryText || 'Party'} />
                    )}
                    {renderActionButton()}
                    {!hideStatusBadge && poc.isActivePersonOrContact !== null && (
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-1 border ${poc.isActivePersonOrContact ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {poc.isActivePersonOrContact ? 'Active' : 'Inactive'}
                        </span>
                    )}
                </div>
            </div>

            {/* Name breakdown */}
            {(showField('forenames') || showField('surname')) && (poc.forenames || poc.surname) && (
                <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
                    {showField('forenames') && <Field label="Forenames" value={poc.forenames} />}
                    {showField('surname') && <Field label="Surname"   value={poc.surname} />}
                </div>
            )}

            {/* Contact info */}
            {(() => {
                const emailVal = poc.email || (Array.isArray((poc as any).emails) && (poc as any).emails.length > 0 ? (poc as any).emails[0] : null);
                if ((showField('email') || showField('phones')) && (emailVal || poc.phones?.length > 0)) {
                    return (
                        <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
                            {showField('email') && emailVal && <Field label="Email" value={emailVal} />}
                            {showField('phones') && poc.phones.map((p, i) => (
                                <Field key={i} label={p.type} value={p.number} />
                            ))}
                        </div>
                    );
                }
                return null;
            })()}

            {/* Individual attributes */}
            {(showField('nationality') || showField('countryOfResidence') || showField('dateOfBirth') || showField('placeOfBirth') || showField('correspondenceAddress')) && (poc.nationality?.length > 0 || poc.countryOfResidence || dob || poc.placeOfBirth || poc.correspondenceAddress) && (
                <div className="grid grid-cols-2 gap-y-2 mt-2 pt-2 border-t border-border">
                    {showField('nationality') && poc.nationality?.length > 0 && (
                        <Field label="Nationality" value={poc.nationality.join(', ')} />
                    )}
                    {showField('countryOfResidence') && poc.countryOfResidence && (
                        <Field label="Country of Residence" value={poc.countryOfResidence} />
                    )}
                    {showField('dateOfBirth') && dob && <Field label="Date of Birth" value={dob} />}
                    {showField('placeOfBirth') && poc.placeOfBirth && <Field label="Place of Birth" value={poc.placeOfBirth} />}
                    {showField('correspondenceAddress') && poc.correspondenceAddress && (
                        <Field label="Correspondence Address" value={getAddressSummary(poc.correspondenceAddress)} />
                    )}
                </div>
            )}

            {/* Roles */}
            {showField('roles') && poc.roles?.length > 0 && (
                <div className="border-b border-border pb-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                        Roles
                    </span>
                    <div className="divide-y divide-border">
                        {poc.roles.map((role, i) => (
                            <RoleRow key={i} role={role} displayMask={displayMask} index={i} />
                        ))}
                    </div>
                </div>
            )}

            {/* Source identifiers */}
            {showField('sourceIdentifiers') && poc.sourceIdentifiers?.length > 0 && (
                <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                        Source Identifiers
                    </span>
                    <div className="flex flex-col gap-1">
                        {poc.sourceIdentifiers.map((si, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground font-mono">{si.scheme}</span>
                                <span className="text-foreground">{si.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
