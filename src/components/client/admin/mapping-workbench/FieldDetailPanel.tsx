"use client";

import { WorkbenchField } from "@/actions/mapping-workbench";
import { FieldWarning, warningColour } from "@/lib/mapping-workbench/warnings";
import { Badge } from "@/components/ui/badge";
import {
    X, AlertCircle, AlertTriangle, Info,
    CheckCircle2, ExternalLink, Repeat2,
    FileText, GitBranch, Tag, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_COLOURS: Record<string, string> = {
    GLEIF: "bg-purple-100 text-purple-700 border-purple-200",
    REGISTRATION_AUTHORITY: "bg-red-100 text-red-700 border-red-200",
    COMPANIES_HOUSE: "bg-red-100 text-red-700 border-red-200",
    USER_INPUT: "bg-slate-100 text-slate-600 border-slate-200",
    AI_EXTRACTION: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLOURS: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    APPROVED: "bg-blue-100 text-blue-700",
    SHARED: "bg-amber-100 text-amber-700",
    RELEASED: "bg-emerald-100 text-emerald-700",
};

const TRANSFORM_LABELS: Record<string, string> = {
    DIRECT: "Direct",
    DATE_TO_ISO: "Date → ISO",
    DATETIME_TO_ISO: "DateTime → ISO",
    COUNTRY_TO_NAME: "Country code → Name",
    COUNTRY_TO_ISO2: "Country → ISO 2",
    ENUM_MAP: "Enum map",
    FIRST_ARRAY_ITEM: "First array item",
    JOIN_ARRAY: "Join array",
    TO_ADDRESS_OBJECT: "→ Address object",
    TO_PARTY_OBJECT: "→ Party object",
    TO_PARTY_LIST: "→ Party list",
};

export function FieldDetailPanel({ field, onClose }: {
    field: WorkbenchField;
    onClose: () => void;
}) {
    const activeMappings = field.sourceMappings.filter(m => m.isActive);
    const inactiveMappings = field.sourceMappings.filter(m => !m.isActive);

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        <span className="text-xs font-mono text-slate-400 block">F{field.fieldNo}</span>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">{field.fieldName}</h2>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {field.categoryName && (
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{field.categoryName}</Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-mono">{field.appDataType}</Badge>
                            {field.isMultiValue && (
                                <Badge className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200 border">
                                    <Repeat2 className="w-3 h-3 mr-1" />Repeating
                                </Badge>
                            )}
                            {field.fmsbRef && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-slate-500">
                                    FMSB: {field.fmsbRef}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">

                {/* ── Warnings ── */}
                {field.warnings.length > 0 && (
                    <section className="p-4 space-y-2">
                        <SectionTitle>Warnings</SectionTitle>
                        {field.warnings.map(w => <WarningCard key={w.code} warning={w} />)}
                    </section>
                )}

                {/* ── Description ── */}
                <section className="p-4 space-y-2">
                    <SectionTitle>Field Definition</SectionTitle>
                    {field.description ? (
                        <p className="text-sm text-slate-700 leading-relaxed">{field.description}</p>
                    ) : (
                        <p className="text-sm text-slate-400 italic">No public description yet.</p>
                    )}
                    {field.notes && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                            <span className="font-medium text-slate-600">Admin note: </span>{field.notes}
                        </div>
                    )}
                    {field.domain.length > 0 && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                            {field.domain.map(d => (
                                <span key={d} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                    {d}
                                </span>
                            ))}
                        </div>
                    )}
                    {field.options.length > 0 && (
                        <div className="mt-2">
                            <span className="text-xs text-slate-500 font-medium">Options: </span>
                            <span className="text-xs text-slate-600">{field.options.join(", ")}</span>
                        </div>
                    )}
                </section>

                {/* ── Source Mappings ── */}
                <section className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <SectionTitle icon={<GitBranch className="w-3.5 h-3.5" />}>
                            Source Mappings
                        </SectionTitle>
                        <span className="text-xs text-slate-400">
                            {activeMappings.length} active · {inactiveMappings.length} inactive
                        </span>
                    </div>

                    {field.sourceMappings.length === 0 ? (
                        <EmptyState>No source mappings configured for this field.</EmptyState>
                    ) : (
                        <div className="space-y-2">
                            {/* Active first */}
                            {field.sourceMappings.map(m => (
                                <div key={m.id} className={cn(
                                    "rounded-lg border p-3 space-y-2 text-sm",
                                    m.isActive
                                        ? "border-slate-200 bg-white"
                                        : "border-slate-100 bg-slate-50 opacity-60"
                                )}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
                                                SOURCE_COLOURS[m.sourceType] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                            )}>
                                                {m.sourceType === "REGISTRATION_AUTHORITY" ? "Registry" : m.sourceType}
                                            </span>
                                            {m.sourceReference && (
                                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {m.sourceReference}
                                                </span>
                                            )}
                                            {!m.isActive && (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0">
                                            priority {m.priority} · {Math.round(m.confidenceDefault * 100)}% confidence
                                        </span>
                                    </div>

                                    {/* Source name */}
                                    <p className="text-[11px] text-slate-500 font-medium">{m.sourceDisplayName}</p>

                                    {/* Path */}
                                    <div className="flex items-start gap-2">
                                        <span className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5 w-14">Path</span>
                                        <code className="text-[11px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded break-all">
                                            {m.sourcePath}
                                        </code>
                                    </div>

                                    {/* Meaning */}
                                    {m.pathMeaning && (
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5 w-14">Meaning</span>
                                            <span className="text-[11px] text-slate-700">{m.pathMeaning}</span>
                                        </div>
                                    )}

                                    {/* Example value */}
                                    {m.exampleValue && (
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5 w-14">Example</span>
                                            <code className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded break-all">
                                                {m.exampleValue}
                                            </code>
                                        </div>
                                    )}

                                    {/* Transform */}
                                    {m.transformType !== "DIRECT" && (
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5 w-14">Transform</span>
                                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                {TRANSFORM_LABELS[m.transformType] ?? m.transformType}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Group Membership ── */}
                {field.groupMembership.length > 0 && (
                    <section className="p-4 space-y-2">
                        <SectionTitle icon={<Tag className="w-3.5 h-3.5" />}>Group Membership</SectionTitle>
                        <div className="flex flex-wrap gap-1.5">
                            {field.groupMembership.map(g => (
                                <span key={g.groupKey} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-md font-medium">
                                    {g.groupLabel}
                                </span>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            This field is part of a virtual group. Questions may be mapped to the group rather than this individual field.
                        </p>
                    </section>
                )}

                {/* ── Questionnaire Usage ── */}
                <section className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <SectionTitle icon={<FileText className="w-3.5 h-3.5" />}>Questionnaire Usage</SectionTitle>
                        <span className="text-xs text-slate-400">{field.questionUsage.length} question(s)</span>
                    </div>

                    {field.questionUsage.length === 0 ? (
                        <EmptyState>This field is not mapped to any questionnaire questions.</EmptyState>
                    ) : (
                        <div className="space-y-1.5">
                            {field.questionUsage.map(q => (
                                <div key={q.questionId} className="flex items-start gap-2 rounded-lg border border-slate-100 p-3 bg-slate-50/50">
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 font-medium leading-snug">{q.questionText}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-slate-400 truncate">{q.questionnaireName}</span>
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOURS[q.status] ?? "bg-slate-100 text-slate-500")}>
                                                {q.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Repeating + questionnaire usage note */}
                    {field.isMultiValue && field.questionUsage.length > 0 && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 leading-relaxed">
                            <strong>Note:</strong> This is a repeating field. The questionnaire will show an array summary (e.g. "3 values") rather than individual rows. Row-level binding is not yet supported.
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            {icon}
            {children}
        </h3>
    );
}

function EmptyState({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-sm text-slate-400 italic py-2">{children}</p>
    );
}

function WarningCard({ warning }: { warning: FieldWarning }) {
    const c = warningColour(warning.severity);
    const Icon = warning.severity === "error" ? AlertCircle
        : warning.severity === "warning" ? AlertTriangle
        : Info;

    return (
        <div className={cn("rounded-lg border px-3 py-2.5 flex gap-2.5", c.bg, c.border)}>
            <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", c.icon)} />
            <div>
                <p className={cn("text-xs font-semibold", c.text)}>{warning.title}</p>
                <p className={cn("text-[11px] mt-0.5 leading-relaxed", c.text, "opacity-80")}>{warning.detail}</p>
            </div>
        </div>
    );
}
