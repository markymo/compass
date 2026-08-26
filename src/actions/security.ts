"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

/**
 * Checks if the current user holds the explicit SYSTEM_ADMIN role.
 */
export async function isSystemAdmin() {
    const identity = await getIdentity();
    if (!identity) return false;

    const adminMembership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            role: "SYSTEM_ADMIN"
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
