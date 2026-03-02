"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getAccountSettings, updateAccountSettings } from "@/actions/account";
import { toast } from "sonner";

interface UserPreferences {
    whimsyMode?: boolean;
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

    useEffect(() => {
        const fetchPrefs = async () => {
            const res = await getAccountSettings();
            if (res.success && res.data) {
                setPreferences((res.data as any).preferences || {});
            }
            setIsLoading(false);
        };
        fetchPrefs();
    }, []);

    const updatePreference = async (key: keyof UserPreferences, value: any) => {
        const updated = { ...preferences, [key]: value };
        setPreferences(updated);

        const res = await updateAccountSettings({ preferences: { [key]: value } });
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
