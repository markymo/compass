import { auth, currentUser } from "@clerk/nextjs/server";
import { AuthProvider, AuthIdentity } from "../index";

export const clerkProvider: AuthProvider = {
    async getIdentity(): Promise<AuthIdentity | null> {
        const { userId, sessionClaims } = await auth();

        if (!userId) {
            return null;
        }

        // 1. Try Session Claims First (Fastest)
        const email = (sessionClaims?.email as string) || null;
        if (email) {
            return { userId, email };
        }

        // 2. Fallback to API Call if needed
        const user = await currentUser();
        return {
            userId,
            email: user?.emailAddresses?.[0]?.emailAddress || null
        };
    }
};
