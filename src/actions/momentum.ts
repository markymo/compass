"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./security";

export interface CategoryReadiness {
    id: string;
    key: string;
    displayName: string;
    totalFields: number;
    descriptionCount: number;
    ukMappingCount: number;
    fullyCompleteCount: number;
    actionsToComplete: number;
}

export interface MomentumReadiness {
    totalFields: number;
    describedFields: number;
    ukMappedFields: number;
    fullyCompleteFields: number;
    categories: CategoryReadiness[];
}

/**
 * Momentum Readiness Service (Slice 2 - Core Computation)
 * Calculates schema completion metrics based on active MasterFieldDefinitions.
 */
export async function getMomentumReadiness(): Promise<MomentumReadiness> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // Fetch all active fields with their mappings and category
    const fields = await prisma.masterFieldDefinition.findMany({
        where: { isActive: true },
        include: {
            sourceMappings: {
                where: { isActive: true }
            },
            masterDataCategory: true
        }
    });

    const categories = await prisma.masterDataCategory.findMany({
        orderBy: { order: 'asc' }
    });

    // Constants
    const UK_CH_RA_ID = 'RA000585';
    const MIN_DESC_LENGTH = 20;
    const PLACEHOLDER_REGEX = /^(tbc|todo|placeholder|test|asdf|none|n\/a|details here)/i;

    const isDescriptionValid = (desc: string | null) => {
        if (!desc) return false;
        const trimmed = desc.trim();
        return trimmed.length >= MIN_DESC_LENGTH && !PLACEHOLDER_REGEX.test(trimmed);
    };

    const hasUKCHMapping = (mappings: any[]) => {
        return mappings.some(m => 
            m.sourceType === 'COMPANIES_HOUSE' || 
            (m.sourceType === 'REGISTRATION_AUTHORITY' && m.sourceReference === UK_CH_RA_ID)
        );
    };

    // Calculate global metrics
    const totalFields = fields.length;
    const describedFields = fields.filter(f => isDescriptionValid(f.description)).length;
    const ukMappedFields = fields.filter(f => hasUKCHMapping(f.sourceMappings)).length;
    const fullyCompleteFields = fields.filter(f => 
        isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
    ).length;

    // Calculate category-level rollups
    const categoryReadiness: CategoryReadiness[] = categories.map(cat => {
        const catFields = fields.filter(f => f.categoryId === cat.id);
        
        const catDescCount = catFields.filter(f => isDescriptionValid(f.description)).length;
        const catMappingCount = catFields.filter(f => hasUKCHMapping(f.sourceMappings)).length;
        const catCompleteCount = catFields.filter(f => 
            isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
        ).length;

        // "Actions to complete" is the sum of missing dimensions across all fields in category
        // Each field can have up to 2 actions: add description and add UK mapping
        let actions = 0;
        catFields.forEach(f => {
            if (!isDescriptionValid(f.description)) actions++;
            if (!hasUKCHMapping(f.sourceMappings)) actions++;
        });

        return {
            id: cat.id,
            key: cat.key,
            displayName: cat.displayName,
            totalFields: catFields.length,
            descriptionCount: catDescCount,
            ukMappingCount: catMappingCount,
            fullyCompleteCount: catCompleteCount,
            actionsToComplete: actions
        };
    });

    // Handle Uncategorized fields if any
    const uncatFields = fields.filter(f => !f.categoryId);
    if (uncatFields.length > 0) {
        let uncatActions = 0;
        uncatFields.forEach(f => {
            if (!isDescriptionValid(f.description)) uncatActions++;
            if (!hasUKCHMapping(f.sourceMappings)) uncatActions++;
        });

        categoryReadiness.push({
            id: 'uncategorized',
            key: 'UNCAT',
            displayName: 'Uncategorized',
            totalFields: uncatFields.length,
            descriptionCount: uncatFields.filter(f => isDescriptionValid(f.description)).length,
            ukMappingCount: uncatFields.filter(f => hasUKCHMapping(f.sourceMappings)).length,
            fullyCompleteCount: uncatFields.filter(f => 
                isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
            ).length,
            actionsToComplete: uncatActions
        });
    }

    return {
        totalFields,
        describedFields,
        ukMappedFields,
        fullyCompleteFields,
        categories: categoryReadiness
    };
}
