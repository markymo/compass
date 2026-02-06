import { auth } from "@/auth";
import { AuthProvider, AuthIdentity } from "../index";

export const nextAuthProvider: AuthProvider = {
    async getIdentity(): Promise<AuthIdentity | null> {
        const session = await auth();
        if (!session?.user?.id) {
            return null;
        }

        return {
            userId: session.user.id,
            email: session.user.email || null
        };
    }
};
