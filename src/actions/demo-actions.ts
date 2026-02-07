'use server';

import { isSystemAdmin } from './security';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-dev-secret';

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

        return { success: true, token };
    } catch (error) {
        console.error("Impersonation Error:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
