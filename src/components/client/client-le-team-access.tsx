"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getClientLETeamAssignments, saveClientLEPermissions, TeamMemberLEAssignment } from "@/actions/client-le-team";
import { inviteUser, resendInvitation, revokeInvitation } from "@/actions/invitations";
import { CheckCircle2, AlertCircle, Info, Loader2, UserPlus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { z } from "zod";

interface ClientLETeamAccessProps {
    clientLEId: string;
    clientLEName: string;
    orgId: string;
    isInitialSetup?: boolean;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function ClientLETeamAccess({
    clientLEId,
    clientLEName,
    orgId,
    isInitialSetup = false,
    onSuccess,
    onCancel
}: ClientLETeamAccessProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [members, setMembers] = useState<TeamMemberLEAssignment[]>([]);
    const [rolesMap, setRolesMap] = useState<Record<string, "LE_ADMIN" | "LE_USER" | "NONE">>({});

    // Pending invite action states
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    // Add someone by email state
    const [showAddForm, setShowAddForm] = useState(false);
    const [addEmail, setAddEmail] = useState("");
    const [addRole, setAddRole] = useState<"LE_ADMIN" | "LE_USER">("LE_USER");
    const [addingUser, setAddingUser] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    async function loadMembers() {
        setLoading(true);
        setError(null);
        const res = await getClientLETeamAssignments(clientLEId, orgId);

        if (res.success && res.members) {
            setMembers(res.members);
            const initialMap: Record<string, "LE_ADMIN" | "LE_USER" | "NONE"> = {};
            res.members.forEach((m) => {
                if (!m.isPendingInvite) {
                    // Default creator to LE_ADMIN on initial LE setup if no explicit role exists
                    if (isInitialSetup && m.isCurrentUser && m.leRole === "NONE") {
                        initialMap[m.userId] = "LE_ADMIN";
                    } else {
                        initialMap[m.userId] = m.leRole;
                    }
                }
            });
            setRolesMap(initialMap);
        } else {
            setError(res.error || "Failed to load team members.");
        }
        setLoading(false);
    }

    useEffect(() => {
        loadMembers();
    }, [clientLEId, orgId]);

    const handleRoleChange = (userId: string, newRole: "LE_ADMIN" | "LE_USER" | "NONE") => {
        setRolesMap((prev) => ({
            ...prev,
            [userId]: newRole
        }));
    };

    async function handleAddPerson() {
        if (!addEmail || !addEmail.trim()) return;
        const trimmedEmail = addEmail.trim().toLowerCase();

        const emailValidation = z.string().trim().email("Please enter a valid email address.").safeParse(trimmedEmail);
        if (!emailValidation.success) {
            setAddError(emailValidation.error.issues[0].message);
            return;
        }

        // Check if user is already in local list as an active user
        const existingMember = members.find((m) => !m.isPendingInvite && m.email.toLowerCase() === trimmedEmail);
        if (existingMember) {
            handleRoleChange(existingMember.userId, addRole);
            toast.info(`Updated access level for ${existingMember.name || existingMember.email}`);
            setShowAddForm(false);
            setAddEmail("");
            setAddError(null);
            return;
        }

        // Check if user has a pending invitation
        const existingInvite = members.find((m) => m.isPendingInvite && m.email.toLowerCase() === trimmedEmail);
        if (existingInvite) {
            setAddError(`An invitation is already pending for ${trimmedEmail}`);
            return;
        }

        setAddingUser(true);
        setAddError(null);

        try {
            const res = await inviteUser({
                email: trimmedEmail,
                role: addRole,
                clientLEId
            });

            if (res.success) {
                toast.success(res.message || `Invitation sent to ${trimmedEmail}`);
                setShowAddForm(false);
                setAddEmail("");
                await loadMembers();
            } else {
                setAddError(res.error || "Failed to add person.");
            }
        } catch (err: any) {
            setAddError("An unexpected error occurred while sending invitation.");
        } finally {
            setAddingUser(false);
        }
    }

    async function handleResendInvite(invitationId: string, email: string) {
        setResendingId(invitationId);
        const res = await resendInvitation(invitationId);
        setResendingId(null);

        if (res.success) {
            toast.success(`Invitation resent to ${email}`);
        } else {
            toast.error(res.error || "Failed to resend invitation.");
        }
    }

    async function handleRevokeInvite(invitationId: string, email: string) {
        setRevokingId(invitationId);
        const res = await revokeInvitation(invitationId);
        setRevokingId(null);

        if (res.success) {
            toast.success(`Invitation revoked for ${email}`);
            await loadMembers();
        } else {
            toast.error(res.error || "Failed to revoke invitation.");
        }
    }

    async function handleSave() {
        setSaving(true);
        setError(null);

        const assignments = Object.entries(rolesMap).map(([userId, role]) => ({
            userId,
            role
        }));

        const res = await saveClientLEPermissions({
            clientLEId,
            orgId,
            assignments
        });

        setSaving(false);

        if (res.success) {
            toast.success(
                isInitialSetup
                    ? `Team access configured for ${clientLEName}`
                    : `Permissions updated for ${clientLEName}`
            );
            router.refresh();
            if (onSuccess) onSuccess();
        } else {
            setError(res.error || "Failed to save permissions. Entity remains created.");
        }
    }

    if (loading) {
        return (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <p className="text-xs font-medium">Loading team members...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-1">
            {/* Header acknowledgment for Step 2 setup */}
            {isInitialSetup ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-md flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-emerald-950 text-xs">
                            {clientLEName} created successfully
                        </p>
                        <p className="text-[11px] text-emerald-800">
                            Choose which members of your organization can work on this Legal Entity.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold font-heading text-slate-900 leading-tight">Manage Team Access</h3>
                        <p className="text-xs text-slate-500">
                            Configure who can work on <span className="font-medium text-slate-800">{clientLEName}</span>.
                        </p>
                    </div>
                </div>
            )}

            {/* Scope Clarification Notice */}
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md flex items-start gap-2 text-[11px] text-slate-600">
                <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold text-slate-800">Access to this Legal Entity only. </span>
                    Changes here do not affect organisation roles or access to other Legal Entities.
                </div>
            </div>

            {/* Action Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-md flex items-start gap-2 text-xs">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-900">Unable to save permissions</p>
                        <p className="text-[11px]">{error}</p>
                    </div>
                </div>
            )}

            {/* Action Header: Crisp Outline Action */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-800">Team Members ({members.length})</span>
                {!showAddForm && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                        className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 font-medium px-2.5"
                    >
                        <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
                        + Add someone
                    </Button>
                )}
            </div>

            {/* Expandable Add Someone Form with Soft Indigo Canvas */}
            {showAddForm && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">Add person by email</span>
                        <button
                            type="button"
                            onClick={() => { setShowAddForm(false); setAddError(null); }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {addError && (
                        <p className="text-[11px] text-red-600 font-medium">{addError}</p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            type="email"
                            placeholder="colleague@example.com"
                            value={addEmail}
                            autoFocus
                            onChange={(e) => setAddEmail(e.target.value)}
                            className="h-8 text-xs bg-white border-slate-200"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-md shrink-0 text-[11px] font-medium border border-slate-200 gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => setAddRole("LE_USER")}
                                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                                        addRole === "LE_USER"
                                            ? "border-2 border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs"
                                            : "border-2 border-transparent text-slate-600 hover:text-slate-900 bg-transparent"
                                    }`}
                                >
                                    {addRole === "LE_USER" && <Check className="h-3 w-3 stroke-[3] text-indigo-600" />}
                                    User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddRole("LE_ADMIN")}
                                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                                        addRole === "LE_ADMIN"
                                            ? "border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs"
                                            : "border-2 border-transparent text-slate-600 hover:text-slate-900 bg-transparent"
                                    }`}
                                >
                                    {addRole === "LE_ADMIN" && <Check className="h-3 w-3 stroke-[3] text-emerald-600" />}
                                    Admin
                                </button>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleAddPerson}
                                disabled={addingUser || !addEmail}
                                className="h-7 text-xs bg-slate-900 hover:bg-slate-800 text-white px-2.5 font-medium rounded-md shadow-xs"
                            >
                                {addingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dense User Access List */}
            <div className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {members.map((m) => {
                    const currentRole = rolesMap[m.userId] || m.leRole || "NONE";

                    // PENDING INVITATION ROW
                    if (m.isPendingInvite) {
                        const displayRole = m.leRole === "LE_ADMIN" ? "Admin" : "User";
                        return (
                            <div
                                key={m.userId}
                                className="px-3 py-2 flex items-center justify-between gap-2 bg-amber-50/40 hover:bg-amber-50/60 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                        <span className="text-xs font-medium text-slate-900 truncate">
                                            {m.email}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="bg-amber-100/80 text-amber-900 border-amber-300 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0 rounded-md"
                                        >
                                            Invited ({displayRole})
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-amber-700/80 truncate">Invitation pending acceptance</p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResendInvite(m.invitationId!, m.email)}
                                        disabled={resendingId === m.invitationId}
                                        className="h-6 text-[11px] px-2 text-slate-700 border-slate-300 hover:bg-white"
                                        aria-label={`Resend invitation to ${m.email}`}
                                    >
                                        {resendingId === m.invitationId ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            "Resend"
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeInvite(m.invitationId!, m.email)}
                                        disabled={revokingId === m.invitationId}
                                        className="h-6 text-[11px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        aria-label={`Revoke invitation for ${m.email}`}
                                    >
                                        {revokingId === m.invitationId ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            "Revoke"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        );
                    }

                    // ACTIVE MEMBER ROW
                    return (
                        <div
                            key={m.userId}
                            className={`px-3 py-2 flex items-center justify-between gap-2 ${
                                m.isCurrentUser ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                            } transition-colors`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                    <span className="text-xs font-medium text-slate-900 truncate">
                                        {m.name || m.email}
                                    </span>

                                    {/* Compact "You" Indicator */}
                                    {m.isCurrentUser && (
                                        <Badge
                                            variant="secondary"
                                            className="bg-indigo-100 text-indigo-950 border-indigo-200 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0 rounded-md"
                                        >
                                            {isInitialSetup ? "You created this LE" : "You"}
                                        </Badge>
                                    )}

                                    <span className="text-[10px] text-slate-400">· {m.orgRole}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
                            </div>

                            {/* Color Framed Segmented Control: None | User | Admin */}
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-md shrink-0 text-[11px] font-medium border border-slate-200 gap-0.5">
                                <button
                                    type="button"
                                    aria-label={`Set ${m.email} access to None`}
                                    aria-pressed={currentRole === "NONE"}
                                    onClick={() => handleRoleChange(m.userId, "NONE")}
                                    className={`px-2.5 py-0.5 rounded transition-all ${
                                        currentRole === "NONE"
                                            ? "border-2 border-slate-900 bg-slate-100/90 text-slate-950 font-bold shadow-xs"
                                            : "border-2 border-transparent text-slate-500 hover:text-slate-900 bg-transparent"
                                    }`}
                                >
                                    None
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Set ${m.email} access to User`}
                                    aria-pressed={currentRole === "LE_USER"}
                                    onClick={() => handleRoleChange(m.userId, "LE_USER")}
                                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                                        currentRole === "LE_USER"
                                            ? "border-2 border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs"
                                            : "border-2 border-transparent text-slate-600 hover:text-slate-900 bg-transparent"
                                    }`}
                                >
                                    {currentRole === "LE_USER" && <Check className="h-3 w-3 stroke-[3] text-indigo-600" />}
                                    User
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Set ${m.email} access to Admin`}
                                    aria-pressed={currentRole === "LE_ADMIN"}
                                    onClick={() => handleRoleChange(m.userId, "LE_ADMIN")}
                                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                                        currentRole === "LE_ADMIN"
                                            ? "border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs"
                                            : "border-2 border-transparent text-slate-600 hover:text-slate-900 bg-transparent"
                                    }`}
                                >
                                    {currentRole === "LE_ADMIN" && <Check className="h-3 w-3 stroke-[3] text-emerald-600" />}
                                    Admin
                                </button>
                            </div>
                        </div>
                    );
                })}

                {members.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                        No team members found. Click "+ Add someone" above.
                    </div>
                )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
                {onCancel && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        disabled={saving}
                        className="h-8 text-xs text-slate-600 hover:bg-slate-100"
                    >
                        {isInitialSetup ? "Skip for now" : "Cancel"}
                    </Button>
                )}
                <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 font-medium rounded-md shadow-xs"
                >
                    {saving ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            Saving...
                        </>
                    ) : isInitialSetup ? (
                        "Finish setup"
                    ) : (
                        "Save access"
                    )}
                </Button>
            </div>
        </div>
    );
}
