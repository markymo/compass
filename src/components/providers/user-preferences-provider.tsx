"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountSettings, updateAccountSettings } from "@/actions/account";
import { toast } from "sonner";

interface UserPreferences {
    whimsyMode?: boolean;
    adminSidebarCollapsed?: boolean;
    homePage?: {
        collapsedTreeNodes?: Record<string, boolean>;
    };
    [key: string]: any;
}

interface UserPreferencesContextType {
    preferences: UserPreferences;
    isLoading: boolean;
    updatePreference: (key: keyof UserPreferences, value: any) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [preferences, setPreferences] = useState<UserPreferences>({});
    const [isLoading, setIsLoading] = useState(true);
    const { data: session } = useSession();

    useEffect(() => {
        const fetchPrefs = async () => {
            const res = await getAccountSettings();
            if (res.success && res.data) {
                setPreferences((res.data as any).preferences || {});
            } else {
                setPreferences({});
            }
            setIsLoading(false);
        };
        
        if (session?.user?.id) {
            fetchPrefs();
        } else {
            setPreferences({});
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    const updatePreference = async (key: keyof UserPreferences, value: any) => {
        // Prepare the value for this specific key
        let newValue = value;
        
        // If it's an object (like homePage), merge with existing to avoid wiping sub-keys
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const existingValue = (preferences as any)[key] || {};
            newValue = { ...existingValue, ...value };
        }

        const updated = { ...preferences, [key]: newValue };
        setPreferences(updated);

        // We send just the changed key to the server, 
        // updateAccountSettings handles the top-level merge of preferences.
        const res = await updateAccountSettings({ preferences: { [key]: newValue } });
        
        if (!res.success) {
            toast.error(res.error || "Failed to save preference");
            // Rollback on failure
            setPreferences(preferences);
        }
    };

    return (
        <UserPreferencesContext.Provider value={{ preferences, isLoading, updatePreference }}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = useContext(UserPreferencesContext);
    if (context === undefined) {
        throw new Error("usePreferences must be used within a UserPreferencesProvider");
    }
    return context;
}
