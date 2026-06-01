"use client";

/**
 * CodeListField.tsx
 *
 * Controlled-vocabulary collection field component.
 * Replaces the free-text add input and the per-row edit pencil for fields
 * that have a codeSystem configured in COMPLEX_FIELD_CONFIG.
 *
 * Row badge visibility rules:
 *   showBadge = isUserCurated || row.source === 'USER_INPUT'
 *   - Pure registry collection: row badges hover-only.
 *   - User-curated collection: row badges always visible (users need to distinguish
 *     registry-sourced rows from user-added rows).
 *   - USER_INPUT rows: badge always visible regardless of isUserCurated.
 *
 * Delete: calls removeMultiValueEntry (existing tombstone path, unchanged).
 * Add:    calls addCodeListEntry (server-authoritative; no client-supplied label).
 */

import { useState, useMemo } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { addCodeListEntry } from '@/actions/kyc-manual-update';
import { removeMultiValueEntry } from '@/actions/kyc-manual-update';
import { CodeListPickerPopover } from './CodeListPickerPopover';

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_COLOR_MAP: Record<string, string> = {
    REGISTRATION_AUTHORITY: 'bg-blue-100 text-blue-700 border-blue-200',
    USER_INPUT:             'bg-purple-100 text-purple-700 border-purple-200',
    GLEIF:                  'bg-orange-100 text-orange-700 border-orange-200',
    SYSTEM:                 'bg-gray-100 text-gray-700 border-gray-200',
    SYSTEM_DERIVED:         'bg-gray-100 text-gray-700 border-gray-200',
};

const SOURCE_LABEL_MAP: Record<string, string> = {
    REGISTRATION_AUTHORITY: 'Companies House',
    USER_INPUT:             'User input',
    GLEIF:                  'GLEIF',
    SYSTEM:                 'System',
    SYSTEM_DERIVED:         'System',
};

function RowSourceBadge({ source }: { source: string }) {
    const classes = SOURCE_COLOR_MAP[source] ?? 'bg-gray-100 text-gray-700 border-gray-200';
    const label   = SOURCE_LABEL_MAP[source] ?? source;
    return (
        <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
            classes
        )}>
            {label}
        </span>
    );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
    label: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

function DeleteConfirm({ label, onConfirm, onCancel, isDeleting }: DeleteConfirmProps) {
    return (
        <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="truncate max-w-[140px]">Remove <em>{label}</em>?</span>
            <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="shrink-0 text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Remove'}
            </button>
            <button
                onClick={onCancel}
                disabled={isDeleting}
                className="shrink-0 text-slate-400 hover:text-slate-600"
            >
                Cancel
            </button>
        </div>
    );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CodeListRow {
    id: string;
    instanceId?: string;
    value: any;           // { code: string; label: string | null }
    source: string;
    sourceReference?: string;
    timestamp: Date;
    label?: string;
}

interface CodeListFieldProps {
    clientLEId: string;
    fieldNo: number;
    codeSystem: string;
    rows: CodeListRow[];
    /** From getFieldDetail — drives row badge visibility logic. */
    isUserCurated: boolean;
    isLocked?: boolean;
    /** Called after a successful add or remove to trigger parent data reload. */
    onMutate: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CodeListField({
    clientLEId,
    fieldNo,
    codeSystem,
    rows,
    isUserCurated,
    isLocked = false,
    onMutate,
}: CodeListFieldProps) {

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Active codes passed to picker as disabledCodes
    const activeCodes = useMemo(
        () => rows.map(r => r.value?.code).filter(Boolean) as string[],
        [rows]
    );

    // ── Add handler ──────────────────────────────────────────────────────────
    const handleAdd = async (code: string) => {
        setIsAdding(true);
        try {
            const result = await addCodeListEntry(clientLEId, fieldNo, codeSystem, code);
            if (result.success) {
                onMutate();
            } else {
                toast.error(result.message ?? 'Could not add code.');
            }
        } catch (e: any) {
            toast.error(e.message ?? 'Unexpected error adding code.');
        } finally {
            setIsAdding(false);
        }
    };

    // ── Delete handler ───────────────────────────────────────────────────────
    const handleDelete = async (row: CodeListRow) => {
        setIsDeleting(true);
        try {
            const result = await removeMultiValueEntry(
                clientLEId,
                fieldNo,
                row.id  // claimId — removeMultiValueEntry emits tombstone by claimId
            );
            if (result.success) {
                setDeletingId(null);
                onMutate();
            } else {
                toast.error(result.message ?? 'Could not remove code.');
            }
        } catch (e: any) {
            toast.error(e.message ?? 'Unexpected error removing code.');
        } finally {
            setIsDeleting(false);
        }
    };

    // ── Row label ────────────────────────────────────────────────────────────
    const rowLabel = (row: CodeListRow) => {
        const code  = row.value?.code  ?? '???';
        const label = row.value?.label ?? row.label ?? '';
        return label ? `${code} — ${label}` : code;
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-2">

            {/* ── Row list ── */}
            {rows.length > 0 ? (
                <div className="divide-y divide-slate-50">
                    {rows.map(row => {
                        // Badge visibility: always for USER_INPUT or when collection is curated
                        const showBadge = isUserCurated || row.source === 'USER_INPUT';
                        const isBeingDeleted = deletingId === row.id;

                        return (
                            <div
                                key={row.id}
                                className="group flex items-start gap-2 py-2 px-1 rounded hover:bg-slate-50/80 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    {isBeingDeleted ? (
                                        <DeleteConfirm
                                            label={rowLabel(row)}
                                            onConfirm={() => handleDelete(row)}
                                            onCancel={() => setDeletingId(null)}
                                            isDeleting={isDeleting}
                                        />
                                    ) : (
                                        <div className="space-y-0.5">
                                            <span className="text-sm text-slate-800 font-medium">
                                                {rowLabel(row)}
                                            </span>
                                            {/* Row provenance badge */}
                                            <div className={cn(
                                                'transition-opacity',
                                                showBadge
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover:opacity-100'
                                            )}>
                                                <RowSourceBadge source={row.source} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Delete button — always present, hidden when confirming */}
                                {!isLocked && !isBeingDeleted && (
                                    <button
                                        onClick={() => setDeletingId(row.id)}
                                        className="shrink-0 p-1.5 rounded text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove code"
                                        disabled={isDeleting || isAdding}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Empty state */
                <p className="text-sm text-slate-400 italic py-2 text-center">
                    {/* Empty state text comes from CODE_SYSTEMS config via picker */}
                    No codes assigned
                </p>
            )}

            {/* ── Add button (picker) ── */}
            {!isLocked && (
                <div className="pt-2 mt-1 border-t border-slate-100">
                    <CodeListPickerPopover
                        codeSystem={codeSystem}
                        disabledCodes={activeCodes}
                        onSelect={handleAdd}
                        isSubmitting={isAdding}
                    />
                </div>
            )}
        </div>
    );
}
