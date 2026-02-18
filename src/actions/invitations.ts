"use server";

import { Action } from "@/lib/auth/permissions";

// STUB FILE: Temporarily disables Team Invitations to fix Vercel Build.
// The original file was renamed to .bak because `Invitation` model changed
// to be exclusively for Supplier Engagements.
// TODO: Refactor Team Invitations to use a new model or polymorphic approach.

export async function inviteUser(data: any) {
    throw new Error("Team Invitations are temporarily disabled for system upgrades.");
    return { success: false, error: "Team Invitations are temporarily disabled." };
}

export async function revokeInvitation(invitationId: string) {
    throw new Error("Team Invitations are temporarily disabled.");
    return { success: false, error: "Disabled" };
}

export async function getPendingInvitations(orgId: string) {
    // Return empty array to not break the UI list
    return [];
}

export async function acceptInvitation(token: string) {
    throw new Error("This type of invitation is temporarily disabled.");
    return { success: false, error: "Disabled" };
}
