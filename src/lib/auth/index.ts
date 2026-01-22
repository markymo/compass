import { clerkProvider } from "./providers/clerk";

export interface AuthIdentity {
    userId: string;
    email: string | null;
}

export interface AuthProvider {
    getIdentity(): Promise<AuthIdentity | null>;
}

// Default to Clerk for now
const currentProvider: AuthProvider = clerkProvider;

export async function getIdentity(): Promise<AuthIdentity | null> {
    return await currentProvider.getIdentity();
}
