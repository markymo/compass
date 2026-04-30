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

export interface FieldReadinessRow {
    fieldNo: number;
    fieldName: string;
    categoryName: string;
    categoryOrder: number;
    descriptionStatus: boolean;
    ukMappingStatus: boolean;
    isFullyComplete: boolean;
    actionsToComplete: number;
}

export interface MomentumReadiness {
    totalFields: number;
    describedFields: number;
    ukMappedFields: number;
    fullyCompleteFields: number;
    categories: CategoryReadiness[];
    fields: FieldReadinessRow[];
    nextBestAction: {
        type: "DESCRIPTION" | "MAPPING";
        fieldNo: number;
        fieldName: string;
        categoryName: string;
        categoryKey: string;
        actionsToComplete: number;
        fullyCompleteCount: number;
        totalFields: number;
    } | null;
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
    const describedFields = fields.filter((f: any) => isDescriptionValid(f.description)).length;
    const ukMappedFields = fields.filter((f: any) => hasUKCHMapping(f.sourceMappings)).length;
    const fullyCompleteFields = fields.filter((f: any) => 
        isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
    ).length;

    // Calculate category-level rollups
    const categoryReadiness: CategoryReadiness[] = categories.map((cat: any) => {
        const catFields = fields.filter((f: any) => f.categoryId === cat.id);
        
        const catDescCount = catFields.filter((f: any) => isDescriptionValid(f.description)).length;
        const catMappingCount = catFields.filter((f: any) => hasUKCHMapping(f.sourceMappings)).length;
        const catCompleteCount = catFields.filter((f: any) => 
            isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
        ).length;

        // "Actions to complete" is the sum of missing dimensions across all fields in category
        // Each field can have up to 2 actions: add description and add UK mapping
        let actions = 0;
        catFields.forEach((f: any) => {
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
    const uncatFields = fields.filter((f: any) => !f.categoryId);
    if (uncatFields.length > 0) {
        let uncatActions = 0;
        uncatFields.forEach((f: any) => {
            if (!isDescriptionValid(f.description)) uncatActions++;
            if (!hasUKCHMapping(f.sourceMappings)) uncatActions++;
        });

        categoryReadiness.push({
            id: 'uncategorized',
            key: 'UNCAT',
            displayName: 'Uncategorized',
            totalFields: uncatFields.length,
            descriptionCount: uncatFields.filter((f: any) => isDescriptionValid(f.description)).length,
            ukMappingCount: uncatFields.filter((f: any) => hasUKCHMapping(f.sourceMappings)).length,
            fullyCompleteCount: uncatFields.filter((f: any) => 
                isDescriptionValid(f.description) && hasUKCHMapping(f.sourceMappings)
            ).length,
            actionsToComplete: uncatActions
        });
    }

    // --- NEXT BEST ACTION (NBA) SELECTION LOGIC ---
    let nextBestAction = null;

    // 1. Identify nearly complete categories (1-5 actions remaining)
    const nearlyComplete = categoryReadiness
        .filter(c => c.actionsToComplete > 0 && c.actionsToComplete <= 5)
        .sort((a, b) => a.actionsToComplete - b.actionsToComplete);

    let chosenCategory = nearlyComplete[0];

    // 2. Fallback to highest completion percentage for any incomplete category
    if (!chosenCategory) {
        const incomplete = categoryReadiness
            .filter(c => c.actionsToComplete > 0)
            .sort((a, b) => {
                const aPct = a.totalFields > 0 ? a.fullyCompleteCount / a.totalFields : 0;
                const bPct = b.totalFields > 0 ? b.fullyCompleteCount / b.totalFields : 0;
                return bPct - aPct;
            });
        chosenCategory = incomplete[0];
    }

    if (chosenCategory) {
        // Find all fields belonging to this category
        const catFields = fields.filter((f: any) => 
            (f.categoryId === chosenCategory.id) || 
            (chosenCategory.id === 'uncategorized' && !f.categoryId)
        );

        // Find the specific field/gap to recommend
        // Logic: Prefer missing description first, then missing mapping
        const fieldWithMissingDesc = catFields.find((f: any) => !isDescriptionValid(f.description));
        const fieldWithMissingMap = catFields.find((f: any) => !hasUKCHMapping(f.sourceMappings));

        const targetField = fieldWithMissingDesc || fieldWithMissingMap;

        if (targetField) {
            nextBestAction = {
                type: fieldWithMissingDesc ? "DESCRIPTION" : "MAPPING",
                fieldNo: targetField.fieldNo,
                fieldName: targetField.fieldName,
                categoryName: chosenCategory.displayName,
                categoryKey: chosenCategory.key,
                actionsToComplete: chosenCategory.actionsToComplete,
                fullyCompleteCount: chosenCategory.fullyCompleteCount,
                totalFields: chosenCategory.totalFields
            };
        }
    }

    // Map field-level readiness rows
    const fieldReadinessRows: FieldReadinessRow[] = fields.map((f: any) => {
        const descValid = isDescriptionValid(f.description);
        const mapValid = hasUKCHMapping(f.sourceMappings);
        let actions = 0;
        if (!descValid) actions++;
        if (!mapValid) actions++;

        return {
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            categoryName: f.masterDataCategory?.displayName || "Uncategorized",
            categoryOrder: f.masterDataCategory?.order ?? 9999,
            descriptionStatus: descValid,
            ukMappingStatus: mapValid,
            isFullyComplete: descValid && mapValid,
            actionsToComplete: actions
        };
    });

    // Default Sort: Incomplete first, Fewest actions first, Category order, Field number
    fieldReadinessRows.sort((a, b) => {
        // 1. Incomplete first (isFullyComplete: false comes first)
        if (a.isFullyComplete !== b.isFullyComplete) {
            return a.isFullyComplete ? 1 : -1;
        }
        // 2. Fewest actions to complete first (among incomplete)
        if (a.actionsToComplete !== b.actionsToComplete) {
            return a.actionsToComplete - b.actionsToComplete;
        }
        // 3. Category order
        if (a.categoryOrder !== b.categoryOrder) {
            return a.categoryOrder - b.categoryOrder;
        }
        // 4. Field number
        return a.fieldNo - b.fieldNo;
    });

    return {
        totalFields,
        describedFields,
        ukMappedFields,
        fullyCompleteFields,
        categories: categoryReadiness,
        fields: fieldReadinessRows,
        nextBestAction
    };
}


