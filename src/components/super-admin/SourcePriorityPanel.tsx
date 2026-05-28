"use client";

import { useState } from "react";
import { saveSourcePriorityDefaults, SourcePriorityData } from "@/actions/system";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Info, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";
import { CODE_DEFAULTS, USER_INPUT_PRIORITY } from "@/lib/kyc/source-priority-config";

// ── Source type metadata (enum-level, not per-RA) ────────────────────────────

const SOURCE_TYPE_META: Record<string, {
    label: string;
    description: string;
    badge: string;
    legacy?: boolean;
}> = {
    GLEIF: {
        label: "GLEIF",
        description: "Global Legal Entity Identifier Foundation — international legal entity registry.",
        badge: "bg-purple-100 text-purple-800 border-purple-200",
    },
    REGISTRATION_AUTHORITY: {
        label: "Registration Authority (legacy generic)",
        description: "Fallback used when a claim arrives from an RA with no specific per-RA priority set below. Prefer setting per-registry priorities instead.",
        badge: "bg-slate-100 text-slate-600 border-slate-200",
        legacy: true,
    },
    AI_EXTRACTION: {
        label: "AI Extraction",
        description: "Values extracted automatically from documents via AI.",
        badge: "bg-amber-100 text-amber-800 border-amber-200",
    },
    SYSTEM_DERIVED: {
        label: "System Derived",
        description: "Computed or inferred values with no direct human or registry input.",
        badge: "bg-slate-100 text-slate-700 border-slate-200",
    },
};

// Country code → flag emoji
function countryFlag(code: string): string {
    if (!code || code.length !== 2 || code === "??") return "🏳";
    return code
        .toUpperCase()
        .split("")
        .map((c) => String.fromCodePoint(0x1f1e0 - 65 + c.charCodeAt(0)))
        .join("");
}

interface Props {
    initialData: SourcePriorityData;
}

export function SourcePriorityPanel({ initialData }: Props) {
    const [sourceTypes, setSourceTypes] = useState<Record<string, number>>(
        initialData.sourceTypePriorities
    );
    const [registries, setRegistries] = useState<Record<string, number>>(
        initialData.registryPriorities
    );
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    function handleSourceTypeChange(key: string, raw: string) {
        const val = parseInt(raw, 10);
        setSourceTypes((prev) => ({ ...prev, [key]: isNaN(val) ? prev[key] : val }));
        setDirty(true);
    }

    function handleRegistryChange(key: string, raw: string) {
        const val = parseInt(raw, 10);
        setRegistries((prev) => ({ ...prev, [key]: isNaN(val) ? prev[key] : val }));
        setDirty(true);
    }

    function handleReset() {
        setSourceTypes({ ...CODE_DEFAULTS });
        // Reset per-RA priorities to 500
        const resetRegs = Object.fromEntries(
            Object.keys(registries).map((k) => [k, 500])
        );
        setRegistries(resetRegs);
        setDirty(true);
    }

    async function handleSave() {
        setSaving(true);
        try {
            // Merge source types + per-RA into one flat object for storage
            const combined = { ...sourceTypes, ...registries };
            const result = await saveSourcePriorityDefaults(combined);
            if (result.success) {
                toast.success("Source priorities saved");
                setDirty(false);
            } else {
                toast.error(result.error ?? "Failed to save");
            }
        } catch (e) {
            toast.error("Unexpected error saving priorities");
        } finally {
            setSaving(false);
        }
    }

    const editableSourceTypes = Object.keys(SOURCE_TYPE_META).filter(
        (k) => k !== "USER_INPUT"
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle>Source Priority Defaults</CardTitle>
                        <CardDescription className="mt-1.5 space-y-1">
                            <span className="block">
                                Controls which data source wins when multiple sources claim the same field.
                                <strong className="text-foreground"> Lower number = higher authority.</strong>
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Info className="w-3 h-3 shrink-0" />
                                These are global fallback defaults. Per-field overrides live in the Mapping Workbench.
                            </span>
                        </CardDescription>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Reset
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                            {saving
                                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                : <Save className="w-3.5 h-3.5 mr-1.5" />
                            }
                            Save
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">

                {/* ── Section 1: Source Types ── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        <Globe className="w-3.5 h-3.5" />
                        Source Types
                    </div>

                    {/* USER_INPUT — pinned read-only */}
                    <PriorityRow
                        label="User Input"
                        description="Manual overrides entered by users. Always wins — not configurable."
                        badgeClass="bg-blue-100 text-blue-800 border-blue-200"
                        badgeText="USER_INPUT"
                        value={USER_INPUT_PRIORITY}
                        readOnly
                        locked
                    />

                    {editableSourceTypes.map((key) => {
                        const meta = SOURCE_TYPE_META[key];
                        const val = sourceTypes[key] ?? 500;
                        const codeDefault = CODE_DEFAULTS[key];
                        const isModified = codeDefault !== undefined && val !== codeDefault;
                        return (
                            <PriorityRow
                                key={key}
                                label={meta.label}
                                description={meta.description}
                                badgeClass={meta.badge}
                                badgeText={key}
                                value={val}
                                isModified={isModified}
                                codeDefault={codeDefault}
                                legacy={meta.legacy}
                                onChange={(v) => handleSourceTypeChange(key, v)}
                            />
                        );
                    })}
                </div>

                {/* ── Section 2: Per-Registry ── */}
                {initialData.registryAuthorities.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            <Building2 className="w-3.5 h-3.5" />
                            Per-Registry Defaults
                        </div>
                        <p className="text-xs text-muted-foreground -mt-1 mb-2">
                            When a REGISTRATION_AUTHORITY claim arrives from a specific registry, this priority overrides the generic fallback above.
                        </p>

                        {initialData.registryAuthorities
                            .slice()
                            .sort((a, b) => (registries[a.id] ?? 500) - (registries[b.id] ?? 500))
                            .map((ra) => {
                                const val = registries[ra.id] ?? 500;
                                const isModified = val !== 500;
                                return (
                                    <PriorityRow
                                        key={ra.id}
                                        label={
                                            ra.name !== ra.id
                                                ? `${countryFlag(ra.countryCode)} ${ra.name}`
                                                : `${countryFlag(ra.countryCode)} ${ra.id}`
                                        }
                                        description={ra.id}
                                        badgeClass="bg-emerald-100 text-emerald-800 border-emerald-200"
                                        badgeText={ra.id}
                                        value={val}
                                        isModified={isModified}
                                        codeDefault={500}
                                        onChange={(v) => handleRegistryChange(ra.id, v)}
                                    />
                                );
                            })}
                    </div>
                )}

                <p className="text-xs text-muted-foreground pt-1 border-t">
                    Changes take effect immediately for new enrichment runs. Existing claims are re-ranked on next read via the priority resolver.
                </p>
            </CardContent>
        </Card>
    );
}

// ── Shared row component ──────────────────────────────────────────────────────

interface PriorityRowProps {
    label: string;
    description?: string;
    badgeClass: string;
    badgeText: string;
    value: number;
    readOnly?: boolean;
    locked?: boolean;
    isModified?: boolean;
    codeDefault?: number;
    legacy?: boolean;
    onChange?: (raw: string) => void;
}

function PriorityRow({
    label, description, badgeClass, badgeText,
    value, readOnly, locked, isModified, codeDefault, legacy, onChange,
}: PriorityRowProps) {
    return (
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
            locked ? "bg-muted/30 opacity-60" : "hover:bg-muted/20"
        }`}>
            <div className="w-8 text-center shrink-0">
                <span className="text-base font-bold tabular-nums">{value}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{label}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${badgeClass}`}>
                        {badgeText}
                    </Badge>
                    {locked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                            Hardcoded
                        </Badge>
                    )}
                    {legacy && !locked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                            Legacy
                        </Badge>
                    )}
                    {isModified && !locked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-700 border-orange-200">
                            Modified (default: {codeDefault})
                        </Badge>
                    )}
                </div>
                {description && badgeText !== description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                )}
            </div>
            <div className="w-20 shrink-0">
                <Input
                    type="number"
                    min={1}
                    max={9999}
                    value={value}
                    disabled={readOnly || locked}
                    onChange={(e) => onChange?.(e.target.value)}
                    className="text-center h-8 text-sm"
                />
            </div>
        </div>
    );
}
