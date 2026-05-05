"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

/**
 * Checks if the current user has a SYSTEM role across any organization.
 */
export async function isSystemAdmin() {
    const identity = await getIdentity();
    if (!identity) return false;

    // Check for membership in a SYSTEM type organization
    const adminMembership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organization: {
                types: { has: "SYSTEM" }
            }
        }
    });

    return !!adminMembership;
}

// TODO: Phase out this file. 
// Functions in here are legacy auth helpers that rely on implicit Org-level roles.
// New code should use the explicit `ensureAuthorization` engine in `permissions.ts`.


/**
 * Gets the FI organization the user belongs to (if any).
 */
export async function getUserFIOrg() {
    const identity = await getIdentity();
    if (!identity) return null;

    const membership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organization: { types: { has: "FI" } }
        },
        include: { organization: true }
    });

    return membership?.organization || null;
}
