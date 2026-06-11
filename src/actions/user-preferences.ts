"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

export async function getUserPreferences() {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const prefs = (user?.preferences as Record<string, unknown>) || {};
        console.log(`Fetched preferences for ${identity.userId}:`, prefs);

        return {
            success: true,
            preferences: prefs
        };
    } catch (error) {
        console.error("Failed to fetch user preferences:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateUserPreferences(newPrefs: Record<string, unknown>) {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const currentPrefs = (user?.preferences as Record<string, unknown>) || {};
        const updatedPrefs = { ...currentPrefs, ...newPrefs };
        console.log(`Updating preferences for ${identity.userId}:`, updatedPrefs);

        await prisma.user.update({
            where: { id: identity.userId },
            data: { preferences: updatedPrefs }
        });

        return { success: true, preferences: updatedPrefs };
    } catch (error) {
        console.error("Failed to update user preferences:", error);
        return { success: false, error: "Database error" };
    }
}

function isValidLei(lei: string | null | undefined): boolean {
    if (!lei) return false;
    return /^[A-Z0-9]{20}$/i.test(lei.trim());
}

export async function listSelectableClientLEs() {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };
    try {
        const companies = await prisma.clientLE.findMany({
            where: { isDeleted: false },
            select: {
                id: true,
                name: true,
                lei: true,
                registryReferences: {
                    select: {
                        registryAuthorityId: true,
                        localRegistrationNumber: true
                    }
                }
            },
            orderBy: { name: "asc" }
        });
        return { success: true, companies };
    } catch (error) {
        console.error("Failed to list selectable ClientLEs:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateDefaultMappingCompany(clientLeId: string | null) {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    try {
        if (clientLeId) {
            const exists = await prisma.clientLE.findFirst({
                where: { id: clientLeId, isDeleted: false }
            });
            if (!exists) {
                return { success: false, error: "ClientLE not found or deleted" };
            }
        }

        const user = await prisma.user.findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const currentPrefs = (user?.preferences as Record<string, unknown>) || {};
        const updatedPrefs = { ...currentPrefs, rddDefaultMappingCompanyId: clientLeId };

        await prisma.user.update({
            where: { id: identity.userId },
            data: { preferences: updatedPrefs }
        });

        return { success: true, preferences: updatedPrefs };
    } catch (error) {
        console.error("Failed to update default mapping company:", error);
        return { success: false, error: "Database error" };
    }
}

export interface EffectiveMappingDefaults {
    selectedCompanyId?: string | null;
    selectedCompanyName?: string | null;
    gleifLei?: string;
    registryOverrides?: Record<string, { registeredAs: string }>;
}

export async function getEffectiveMappingDefaults(): Promise<EffectiveMappingDefaults> {
    const identity = await getIdentity();
    if (!identity) return {};

    try {
        const user = await prisma.user.findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const prefs = (user?.preferences as Record<string, unknown>) || {};
        const companyId = prefs.rddDefaultMappingCompanyId as string | undefined;

        if (!companyId) return {};

        const company = await prisma.clientLE.findFirst({
            where: { id: companyId, isDeleted: false },
            include: {
                registryReferences: {
                    select: {
                        registryAuthorityId: true,
                        localRegistrationNumber: true
                    }
                }
            }
        });

        if (!company) {
            const updatedPrefs = { ...prefs };
            delete updatedPrefs.rddDefaultMappingCompanyId;
            await prisma.user.update({
                where: { id: identity.userId },
                data: { preferences: updatedPrefs }
            });
            return {};
        }

        const result: EffectiveMappingDefaults = {
            selectedCompanyId: company.id,
            selectedCompanyName: company.name
        };

        if (company.lei && isValidLei(company.lei)) {
            result.gleifLei = company.lei.trim().toUpperCase();
        }

        const registryOverrides: Record<string, { registeredAs: string }> = {};
        for (const ref of company.registryReferences) {
            const authId = ref.registryAuthorityId?.trim();
            const regNo = ref.localRegistrationNumber?.trim();
            if (authId && regNo) {
                registryOverrides[authId] = { registeredAs: regNo };
            }
        }

        if (Object.keys(registryOverrides).length > 0) {
            result.registryOverrides = registryOverrides;
        }

        return result;
    } catch (error) {
        console.error("Failed to resolve effective mapping defaults:", error);
        return {};
    }
}
