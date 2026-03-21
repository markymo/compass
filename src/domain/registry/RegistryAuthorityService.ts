import prisma from "@/lib/prisma";
import { RegistryAuthority } from "@prisma/client";

export class RegistryAuthorityService {
    /**
     * Resolves a GLEIF registeredAt.id (RAID) to a RegistryAuthority record.
     */
    static async getAuthority(raid: string): Promise<RegistryAuthority | null> {
        return prisma.registryAuthority.findUnique({
            where: { id: raid }
        });
    }

    /**
     * Returns all active authorities.
     */
    static async getActiveAuthorities(): Promise<RegistryAuthority[]> {
        return prisma.registryAuthority.findMany({
            where: { isActive: true }
        });
    }

    /**
     * Resolves a RAID to an internal registry key (e.g. GB_COMPANIES_HOUSE).
     */
    static async getRegistryKey(raid: string): Promise<string | null> {
        const auth = await this.getAuthority(raid);
        return auth?.registryKey || null;
    }
}
