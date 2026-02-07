
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import jwt from "jsonwebtoken"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" }, // Required for Credentials
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
        async session({ session, token }) {
            // Run default logic first (if we could, but we can't easily call super).
            // So we strictly implement the enhancement here.

            if (session.user && token?.sub) {
                session.user.id = token.sub;
                // @ts-ignore
                session.user.isDemoActor = token.isDemoActor;

                // Check System Admin Status
                try {
                    const sysAdmin = await prisma.membership.findFirst({
                        where: {
                            userId: token.sub,
                            organization: { types: { has: "SYSTEM" } }
                        }
                    });
                    // @ts-ignore
                    session.user.isSystemAdmin = !!sysAdmin;
                } catch (e) {
                    console.error("Failed to check sys admin in session", e);
                }
            }
            return session;
        }
    },
    providers: [
        ...authConfig.providers.filter((p: any) => p.id !== "credentials"), // Remove stub
        // Add Full Implementation
        Credentials({
            // You can specify which fields should be submitted, by adding keys to the `credentials` object.
            // e.g. domain, username, password, 2FA token, etc.
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                token: { label: "Impersonation Token", type: "text" }
            },
            authorize: async (credentials) => {
                // 1. Impersonation Flow
                if (credentials?.token) {
                    try {
                        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-dev-secret';
                        const decoded = jwt.verify(credentials.token as string, secret) as any;
                        if (decoded.type === 'impersonation' && decoded.sub) {
                            return await prisma.user.findUnique({ where: { id: decoded.sub } });
                        }
                    } catch (e) {
                        console.error("Impersonation failed", e);
                        return null;
                    }
                }

                // 2. Standard Flow
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(1) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await prisma.user.findUnique({ where: { email } });

                    if (!user || !user.password) return null; // No user or no password set (OAuth only account)

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) return user;
                }

                console.log("Invalid credentials");
                return null;
            }
        })
    ],
})
