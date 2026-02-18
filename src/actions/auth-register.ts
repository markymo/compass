"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs"; // Make sure to use bcryptjs or whatever auth.ts uses
import crypto from "crypto";
import { z } from "zod";

const RegisterSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    token: z.string().optional() // Invitation token for auto-verification
});

export async function registerUser(formData: FormData | z.infer<typeof RegisterSchema>) {
    // 1. Validate Input
    const validatedFields = RegisterSchema.safeParse(formData);

    if (!validatedFields.success) {
        return { success: false, error: "Invalid fields" };
    }

    const { email, password, name, token } = validatedFields.data;

    // 2. Check Existing User
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        return { success: false, error: "Email already in use" };
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Check for Invitation (Auto-Verify Email)
    let emailVerified: Date | null = null;

    if (token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const invite = await prisma.invitation.findUnique({
            where: { tokenHash }
        });

        // Use loose email check? No, strict.
        if (invite && invite.sentToEmail.toLowerCase() === email.toLowerCase() && !invite.revokedAt && new Date() < invite.expiresAt) {
            emailVerified = new Date();
        }
    }

    try {
        // 5. Create User
        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                emailVerified
            }
        });

        return { success: true };
    } catch (e) {
        console.error("Registration failed:", e);
        return { success: false, error: "Something went wrong" };
    }
}
