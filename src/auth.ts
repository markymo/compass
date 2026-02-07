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
    providers: [
        ...authConfig.providers.filter((p: any) => p.id !== "credentials"), // Remove stub
        // Add Full Implementation
        Credentials({
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
