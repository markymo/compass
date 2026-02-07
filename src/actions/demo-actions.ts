'use server';

import { isSystemAdmin } from './security';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getIdentity } from '@/lib/auth';

const JWT_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-dev-secret';

/**
 * Restores the original admin session from the secure cookie.
 */
export async function restoreAdminSession() {
    try {
        const cookieStore = await cookies();
        const restoreToken = cookieStore.get('compass_demo_restore')?.value;

        if (!restoreToken) {
            return { success: false, error: "No restore session found" };
        }

        // Verify the restore token
        const decoded = jwt.verify(restoreToken, JWT_SECRET) as any;
        if (!decoded.sub || decoded.type !== 'admin-restore') {
            return { success: false, error: "Invalid restore token" };
        }

        const adminUser = await prisma.user.findUnique({
            where: { id: decoded.sub }
        });

        if (!adminUser) {
            return { success: false, error: "Admin user not found" };
        }

        // Verify they are still an admin (optional but good)
        // const isAdmin = await checkIsSystemAdmin(adminUser.id);
        // if (!isAdmin) return { success: false, error: "User is no longer an admin" };

        // Generate a new sign-in token for the admin
        const token = jwt.sign(
            {
                sub: adminUser.id,
                email: adminUser.email,
                name: adminUser.name,
                type: 'impersonation' // Re-use the impersonation flow to sign in
            },
            JWT_SECRET,
            { expiresIn: '60s' }
        );

        // Clear the restore cookie
        cookieStore.delete('compass_demo_restore');

        return { success: true, token };

    } catch (error) {
        console.error("Restore Session Error:", error);
        return { success: false, error: "Failed to restore session" };
    }
}

/**
 * Generates a short-lived impersonation token for a designated Demo Actor.
 * @param targetUserId The ID of the user to impersonate.
 */
export async function generateImpersonationToken(targetUserId: string) {
    try {
        const admin = await isSystemAdmin();
        if (!admin) {
            console.error("Unauthorized impersonation attempt.");
            return { success: false, error: "Unauthorized: Only System Admins can impersonate." };
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, email: true, isDemoActor: true, name: true }
        });

        if (!targetUser) {
            return { success: false, error: "User not found." };
        }

        if (!targetUser.isDemoActor) {
            console.error(`Security Violation: Attempt to impersonate non-demo user ${targetUser.email}`);
            return { success: false, error: "Security Violation: Target is not a Demo Actor." };
        }

        // Generate Token
        // Valid for 60 seconds - just enough to complete the sign-in handshake
        const token = jwt.sign(
            {
                sub: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                type: 'impersonation'
            },
            JWT_SECRET,
            { expiresIn: '60s' }
        );

        // Capture current admin ID for restoration
        const identity = await getIdentity();
        if (identity?.userId) {
            const restoreToken = jwt.sign(
                {
                    sub: identity.userId,
                    type: 'admin-restore'
                },
                JWT_SECRET,
                { expiresIn: '24h' } // Valid for 24 hours
            );

            const cookieStore = await cookies();
            cookieStore.set('compass_demo_restore', restoreToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }

        return { success: true, token };
    } catch (error) {
        console.error("Impersonation Error:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

/**
 * Fetches all users marked as Demo Actors.
 */
export async function getDemoActors() {
    try {
        const admin = await isSystemAdmin();
        if (!admin) return [];

        return await prisma.user.findMany({
            where: { isDemoActor: true },
            select: { id: true, name: true, email: true, description: true }
        });
    } catch (error) {
        console.error("Failed to fetch demo actors", error);
        return [];
    }
}
