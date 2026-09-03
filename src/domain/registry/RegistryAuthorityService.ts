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
     * Set of Companies House Registration Authority IDs (England & Wales, Scotland, Northern Ireland).
     */
    static readonly COMPANIES_HOUSE_RAIDS = new Set(['RA000585', 'RA000586', 'RA000587']);

    /**
     * Resolves a RAID to an internal registry key (e.g. GB_COMPANIES_HOUSE).
     * Includes runtime canonicalisation defence for Companies House RAs.
     */
    static async getRegistryKey(raid: string): Promise<string | null> {
        if (this.COMPANIES_HOUSE_RAIDS.has(raid)) {
            return 'GB_COMPANIES_HOUSE';
        }
        const auth = await this.getAuthority(raid);
        return auth?.registryKey || null;
    }

    /**
     * Resolves a RAID to an internal mapping source key (e.g. COMPANIES_HOUSE).
     * Includes runtime canonicalisation defence for Companies House RAs.
     * Falls back to raid itself if mappingSourceKey is null.
     */
    static async getMappingSourceKey(raid: string): Promise<string | null> {
        if (this.COMPANIES_HOUSE_RAIDS.has(raid)) {
            return 'COMPANIES_HOUSE';
        }
        const auth = await this.getAuthority(raid);
        return auth?.mappingSourceKey || auth?.id || null;
    }

    /**
     * Resolves an authority record by mappingSourceKey, registryKey, or ID.
     */
    static async getAuthorityBySourceKey(sourceKey: string): Promise<RegistryAuthority | null> {
        return prisma.registryAuthority.findFirst({
            where: {
                OR: [
                    { mappingSourceKey: sourceKey },
                    { registryKey: sourceKey },
                    { id: sourceKey }
                ]
            }
        });
    }
}
