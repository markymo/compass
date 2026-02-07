import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

export default {
    secret: process.env.AUTH_SECRET,
    providers: [
        // Google({
        //     clientId: process.env.AUTH_GOOGLE_ID,
        //     clientSecret: process.env.AUTH_GOOGLE_SECRET,
        //     allowDangerousEmailAccountLinking: true,
        // }),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                // Placeholder - implementation will be in auth.ts
                return null;
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        session({ session, token }) {
            // In session strategy (used by Creds), user ID is in token.sub
            if (session.user && token?.sub) {
                session.user.id = token.sub;
                // @ts-ignore
                session.user.isDemoActor = token.isDemoActor;
            }
            return session;
        },
        jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                // @ts-ignore
                token.isDemoActor = user.isDemoActor;
            }
            return token;
        }
    }
} satisfies NextAuthConfig
