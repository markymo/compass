"use server";

import prisma from "@/lib/prisma";

export async function getSystemSetting(key: string) {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key }
        });
        return setting?.value ?? null;
    } catch (e) {
        console.error(`Failed to fetch SystemSetting for key: ${key}`, e);
        return null;
    }
}

export async function setSystemSetting(key: string, value: any) {
    try {
        await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        return { success: true };
    } catch (e) {
        console.error(`Failed to set SystemSetting for key: ${key}`, e);
        return { success: false, error: "Failed to save setting" };
    }
}
