import prisma from "@/lib/prisma";
import { MasterFieldDefinition, MasterFieldGroup, MasterFieldGroupItem } from "@prisma/client";

let definitionCache: Record<number, MasterFieldDefinition> | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * getMasterFieldDefinition: Fetches a single field definition from the DB with caching.
 */
export async function getMasterFieldDefinition(fieldNo: number): Promise<MasterFieldDefinition> {
    const now = Date.now();
    if (!definitionCache || (now - lastCacheUpdate > CACHE_TTL)) {
        await refreshDefinitionCache();
    }

    const def = definitionCache![fieldNo];
    if (!def) {
        // If not in cache, one last attempt to find it 
        // (might be a newly added field before cache refresh)
        const fresh = await prisma.masterFieldDefinition.findUnique({
            where: { fieldNo, isActive: true }
        });
        if (!fresh) {
            throw new Error(`Unknown or Inactive Field No: ${fieldNo}`);
        }
        definitionCache![fieldNo] = fresh;
        return fresh;
    }
    return def;
}

/**
 * refreshDefinitionCache: Forces a reload of all active field definitions.
 */
export async function refreshDefinitionCache() {
    const all = await prisma.masterFieldDefinition.findMany({
        where: { isActive: true }
    });
    definitionCache = {};
    all.forEach(d => {
        definitionCache![d.fieldNo] = d;
    });
    lastCacheUpdate = Date.now();
    console.log(`[DefinitionService] Refreshed cache with ${all.length} fields.`);
}

/**
 * invalidateDefinitionCache: Clears the cache.
 */
export function invalidateDefinitionCache() {
    definitionCache = null;
}

/**
 * getMasterFieldGroup: Fetches a virtual field group and its child mappings.
 */
export async function getMasterFieldGroup(groupKey: string): Promise<MasterFieldGroup & { items: MasterFieldGroupItem[] }> {
    const group = await prisma.masterFieldGroup.findUnique({
        where: { key: groupKey, isActive: true },
        include: {
            items: {
                where: { field: { isActive: true } },
                orderBy: { order: 'asc' }
            }
        }
    });
    if (!group) throw new Error(`Unknown or Inactive Field Group: ${groupKey}`);
    return group as any;
}

/**
 * listAllMasterFields: Fetches all active field definitions.
 */
export async function listAllMasterFields(): Promise<MasterFieldDefinition[]> {
    const now = Date.now();
    if (!definitionCache || (now - lastCacheUpdate > CACHE_TTL)) {
        await refreshDefinitionCache();
    }
    return Object.values(definitionCache!);
}

/**
 * listAllMasterGroups: Fetches all active field groups.
 */
export async function listAllMasterGroups(): Promise<MasterFieldGroup[]> {
    return await prisma.masterFieldGroup.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
    });
}

/**
 * listAllMasterGroupsWithItems: Fetches all active field groups with their child field numbers.
 */
export async function listAllMasterGroupsWithItems(): Promise<Array<MasterFieldGroup & { fieldNos: number[] }>> {
    const groups = await prisma.masterFieldGroup.findMany({
        where: { isActive: true },
        include: {
            items: {
                where: { field: { isActive: true } },
                select: { fieldNo: true },
                orderBy: { order: 'asc' }
            }
        },
        orderBy: { order: 'asc' }
    });

    return groups.map(g => ({
        ...g,
        fieldNos: g.items.map(i => i.fieldNo)
    }));
}
