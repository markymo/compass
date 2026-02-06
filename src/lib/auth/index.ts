import { nextAuthProvider } from "./providers/next-auth";

export interface AuthIdentity {
    userId: string;
    email: string | null;
}

export interface AuthProvider {
    getIdentity(): Promise<AuthIdentity | null>;
}

// Switch to NextAuth
const currentProvider: AuthProvider = nextAuthProvider;

export async function getIdentity(): Promise<AuthIdentity | null> {
    return await currentProvider.getIdentity();
}
