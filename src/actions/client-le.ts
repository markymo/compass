"use server";

import prisma from "@/lib/prisma";
import { EngagementStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ExtractedItem } from "./ai-mapper"; // Importing type
import { MasterSchemaDefinition } from "@/types/schema";
import { Action, can } from "@/lib/auth/permissions";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { getIdentity } from "@/lib/auth";
import { getUserFIOrg } from "./security";
import { calculateEngagementMetrics } from "@/lib/metrics-calc";

export async function createLegalEntity(data: { name: string; jurisdiction: string; clientOrgId: string }) {
    if (!data.name || !data.clientOrgId) {
        return { success: false, error: "Name and Client Org ID are required" };
    }

    try {
        const le = await prisma.clientLE.create({
            data: {
                name: data.name,
                jurisdiction: data.jurisdiction,
                status: "ACTIVE",
                owners: {
                    create: {
                        partyId: data.clientOrgId,
                        startAt: new Date()
                    }
                }
            },
        });
        revalidatePath(`/app/le`); // Revalidate list page
        return { success: true, data: le };
    } catch (error) {
        console.error("Failed to create LE:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateClientLEData(clientLEId: string, inputData: Record<string, any>) {
    // 1. Get existing record or create one specific to the "Master Schema"
    // For V1 we assume there is ONE active Master Schema we are answering against.
    // In reality, we might need to find the specific Record linked to the Master Schema version.

    const masterSchema = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    if (!masterSchema) return { success: false, error: "No active Master Schema" };

    try {
        // Find existing record for this LE and Schema
        let record = await prisma.clientLERecord.findFirst({
            where: {
                clientLEId,
                masterSchemaId: masterSchema.id
            }
        });

        if (!record) {
            // Create
            record = await prisma.clientLERecord.create({
                data: {
                    clientLEId,
                    masterSchemaId: masterSchema.id,
                    data: inputData,
                    status: "DRAFT"
                }
            });
        } else {
            // Merge Data
            const currentData = (record.data as Record<string, any>) || {};
            const newData = { ...currentData, ...inputData };

            await prisma.clientLERecord.update({
                where: { id: record.id },
                data: {
                    data: newData
                }
            });
        }

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };

    } catch (error) {
        console.error("Failed to update LE data:", error);
        return { success: false, error: "Update failed" };
    }
}

export async function getEffectiveRequirements(clientLEId: string) {
    // 1. Fetch Engagements and their Linked Questionnaires
    const engagements = await prisma.fIEngagement.findMany({
        where: { clientLEId },
        include: {
            questionnaires: true, // Fetch linked questionnaires
            org: true // To get FI Name
        }
    });

    const allFields = [
        // Category 1: Identity
        { key: "full_legal_name", label: "Full Legal Name", type: "text", categoryId: "1" },
        { key: "incorp_date", label: "Date of Incorporation", type: "date", categoryId: "1" },
        { key: "reg_address", label: "Registered Office Address", type: "text", categoryId: "1" },
        { key: "company_number", label: "Company Registration Number", type: "text", categoryId: "1" },
        { key: "tax_id", label: "Global Tax ID (TIN/VAT)", type: "text", categoryId: "1" },

        // Category 2: Governance & Control
        { key: "entity_type", label: "Legal Entity Type", type: "select", options: ["Limited Company", "Partnership", "Trust", "Statutory Body"], categoryId: "2" },
        { key: "is_listed", label: "Is the entity Publicly Listed?", type: "boolean", categoryId: "2" },
        { key: "nature_of_business", label: "Primary Nature of Business", type: "text", categoryId: "5" },

        // Category 3: Financials
        { key: "fiscal_year_end", label: "Fiscal Year End", type: "text", categoryId: "3" },
        { key: "annual_turnover", label: "Estimated Annual Turnover (USD)", type: "number", categoryId: "3" },
        { key: "audited_accounts_available", label: "Are audited accounts available for the last 3 years?", type: "boolean", categoryId: "3" },

        // Category 4: Contacts & Reps
        { key: "primary_contact_name", label: "Primary KYC Contact Name", type: "text", categoryId: "4" },
        { key: "primary_contact_email", label: "Primary KYC Contact Email", type: "text", categoryId: "4" },
        { key: "authorized_signatory", label: "Authorized Signatory Name", type: "text", categoryId: "4" }
    ];

    // 3. Aggregate Requirements
    // Map: Key -> { requiredBy: Set<FIName>, definition: FieldDef }
    const requirements = new Map<string, { definition: any, requiredBy: Set<string> }>();

    for (const eng of engagements) {
        const fiName = eng.org.name;

        for (const q of eng.questionnaires) {
            // Check extractedContent for generic 'QUESTIONS' that map to a Master Key
            // flexible extraction logic
            const content: any = q.extractedContent;
            let items: any[] = [];

            if (Array.isArray(content)) {
                items = content;
            } else if (content && Array.isArray(content.questions)) {
                items = content.questions;
            } else if (content && Array.isArray(content.fields)) {
                items = content.fields;
            }

            items.forEach(item => {
                // Support both direct extraction schema and question schema
                // Question schema might have 'question' text but we look for 'masterKey' mapping

                // If it's the new question format, it might not have masterKey yet unless mapped.
                // But this code is specifically looking for "QUESTION" type and "masterKey".
                // Let's assume the new format items align or we skip them.

                if ((item.type || "").toLowerCase() === "question" && item.masterKey) {
                    const key = item.masterKey;

                    // Verify key exists in Master Schema
                    const fieldDef = allFields.find(f => f.key === key);
                    if (fieldDef) {
                        if (!requirements.has(key)) {
                            requirements.set(key, { definition: fieldDef, requiredBy: new Set() });
                        }
                        requirements.get(key)!.requiredBy.add(fiName); // Add FI name
                    }
                }
            });
        }
    }

    // 4. Fetch Current Answers
    const record = await prisma.clientLERecord.findFirst({
        where: { clientLEId },
        orderBy: { updatedAt: 'desc' }
    });

    const answers = (record?.data as Record<string, any>) || {};

    // 5. Format Output
    // Show ALL fields from Master Schema, annotated with requirement info
    const fields = allFields.map(fieldDef => {
        const key = fieldDef.key;
        const req = requirements.get(key);

        return {
            ...fieldDef,
            requiredBy: req ? Array.from(req.requiredBy) : [],
            currentValue: (answers[key] as any)?.value || answers[key] || ""
        };
    });

    // Calculate generic progress
    const total = fields.length;
    const filled = fields.filter(f => f.currentValue !== undefined && f.currentValue !== "").length;

    // Start with all requirements, but also include fields that HAVE answers even if not required anymore?
    // For now, let's stick to "Effective Requirements". 
    // If a user answered something that's no longer asked, it might be hidden.

    return {
        success: true,
        fields,
        standingData: answers,
        progress: { total, filled }
    };
}

export async function getLEEngagements(clientLEId: string) {
    try {
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId },
            include: {
                org: true,
                questionnaires: true
            }
        });

        return { success: true, engagements };
    } catch (error) {
        console.error("Failed to fetch LE engagements:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateStandingDataProperty(clientLEId: string, propertyKey: string, payload: { value: any, status?: string }) {
    // For Demo: Use a hardcoded schema ID or find the first one
    const masterSchema = await prisma.masterSchema.findFirst() || { id: "demo-schema-id" };

    try {
        let record = await prisma.clientLERecord.findFirst({
            where: { clientLEId }
        });

        const propertyData = {
            value: payload.value,
            status: payload.status || "VERIFIED",
            updatedAt: new Date().toISOString()
        };

        if (!record) {
            await prisma.clientLERecord.create({
                data: {
                    clientLEId,
                    masterSchemaId: masterSchema.id,
                    data: { [propertyKey]: propertyData },
                    status: "DRAFT"
                }
            });
        } else {
            const currentData = (record.data as Record<string, any>) || {};
            const newData = {
                ...currentData,
                [propertyKey]: propertyData
            };

            await prisma.clientLERecord.update({
                where: { id: record.id },
                data: { data: newData }
            });
        }

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true, propertyData };
    } catch (error) {
        console.error("Failed to update standing data property:", error);
        return { success: false, error: "Update failed" };
    }
}

export async function getStandingData(clientLEId: string) {
    const masterSchema = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    if (!masterSchema) return { success: false, error: "No active Master Schema" };

    try {
        const record = await prisma.clientLERecord.findFirst({
            where: { clientLEId, masterSchemaId: masterSchema.id }
        });

        return { success: true, data: record?.data || {} };
    } catch (error) {
        console.error("Failed to fetch standing data:", error);
        return { success: false, error: "Fetch failed" };
    }
}

export async function getEngagementDetails(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: {
                org: true, // The FI Organization
                // Fetch both Templates (if any) AND Instances
                questionnaires: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        mappings: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
                questionnaireInstances: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        mappings: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    orderBy: { createdAt: 'desc' }
                },
                sharedDocuments: {
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                },
                clientLE: true // Context
            }
        });

        if (!engagement) {
            return { success: false, error: "Engagement not found" };
        }

        // Combine both for the UI, or prioritize Instances
        // For Client View, we mostly care about Instances (what we are working on)
        // effectively 'questionnaires' in the UI maps to 'questionnaireInstances'
        const combinedQuestionnaires = Array.from(
            new Map(
                [...engagement.questionnaireInstances, ...engagement.questionnaires].map(item => [item.id, item])
            ).values()
        );

        // Calculate Metrics
        const metrics = await calculateEngagementMetrics(engagementId);

        return {
            success: true,
            engagement,
            questionnaires: combinedQuestionnaires,
            metrics
        };
    } catch (error) {
        console.error("Error fetching engagement details:", error);
        return { success: false, error: "Failed to fetch engagement details" };
    }
}

export async function createFIEngagement(clientLEId: string, fiName: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // 1. Find or Create the Organization for the FI
        // In a real app, we would search properly. Here we treat 'fiName' as the unique key for demo.
        let fiOrg = await prisma.organization.findFirst({
            where: { name: fiName, types: { has: "FI" } }
        });

        if (!fiOrg) {
            fiOrg = await prisma.organization.create({
                data: {
                    name: fiName,
                    types: ["FI"],
                    memberships: {
                        create: {
                            userId: userId,
                            role: "ADMIN"
                        }
                    }
                }
            });
        }

        // 2. Create the Engagement
        const engagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLEId,
                fiOrgId: fiOrg.id,
                status: EngagementStatus.INVITED,
                activities: {
                    create: {
                        userId: userId,
                        type: "INVITE_SENT",
                        details: { fiName }
                    }
                }
            }
        });

        revalidatePath(`/app/le/${clientLEId}/v2`);
        return { success: true, engagement };
    } catch (error) {
        console.error("Failed to create engagement:", error);
        return { success: false, error: "Failed to create engagement" };
    }
}
// ... (previous code)

/**
 * Fetches all Master Data values for an LE, flattened by Field Number.
 * This is used for the Questionnaire Mapper to show existing values.
 */
export async function getFullMasterData(clientLEId: string) {
    // 1. Fetch ClientLE and IdentityProfile (link to LegalEntity)
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: clientLEId },
        include: {
            identityProfile: true,
        }
    });

    if (!clientLE) return { success: false, data: {} };

    // 2. Resolve LegalEntity ID
    const legalEntityId = clientLE.identityProfile?.legalEntityId;
    let legalEntity: any = null;

    if (legalEntityId) {
        legalEntity = await prisma.legalEntity.findUnique({
            where: { id: legalEntityId },
            include: {
                constitutionalProfile: true,
                entityInfoProfile: true,
                leiRegistration: true,
                relationshipProfile: true,
                // Add other profiles as needed based on Schema
            }
        });
    }

    const flattened: Record<number, { value: any, source?: string }> = {};

    for (const def of Object.values(FIELD_DEFINITIONS)) {
        if (!def.model || !def.field) continue;
        if (def.isRepeating) continue; // Skip repeating fields for now

        let val: any = undefined;

        // Route lookup based on Model
        if (def.model === 'IdentityProfile') {
            // IdentityProfile is on ClientLE (and LegalEntity, but ClientLE is entry)
            val = clientLE.identityProfile ? (clientLE.identityProfile as any)[def.field] : undefined;
        }
        else if (legalEntity) {
            // Other profiles are on LegalEntity
            const profileKey = def.model.charAt(0).toLowerCase() + def.model.slice(1);
            const profile = legalEntity[profileKey];
            if (profile) {
                val = profile[def.field];
            }
        }

        if (val !== undefined && val !== null) {
            flattened[def.fieldNo] = {
                value: val,
                source: 'MASTER_RECORD'
            };
        }
    }

    // 3. Custom Data
    const customData = (clientLE.customData as Record<string, any>) || {};
    let customDefinitions: any[] = [];

    // Strategy: Fetch definitions from:
    // A. The Client LE's Owner (The "Host")
    // B. The Current User's FI (The "Viewer/Editor")
    // C. Any field IDs already present in customData (Data Integrity)

    const owner = await prisma.clientLEOwner.findFirst({
        where: { clientLEId, endAt: null },
        orderBy: { startAt: 'asc' }
    });

    const userFI = await getUserFIOrg();

    // Collect Org IDs to fetch
    const targetOrgIds = new Set<string>();
    if (owner) targetOrgIds.add(owner.partyId);
    if (userFI) targetOrgIds.add(userFI.id);

    // Collect Field IDs from the Data itself (The "Stored at LE Level" truth)
    const targetDefIds = new Set<string>();
    Object.keys(customData).forEach(key => {
        // Simple uuid check or length check to avoid junk
        if (key.length > 20) targetDefIds.add(key);
    });

    if (targetOrgIds.size > 0 || targetDefIds.size > 0) {
        customDefinitions = await prisma.customFieldDefinition.findMany({
            where: {
                OR: [
                    { orgId: { in: Array.from(targetOrgIds) } },
                    { id: { in: Array.from(targetDefIds) } }
                ]
            },
            orderBy: { label: 'asc' }
        });
    }

    // IF `customData` has keys that we missed (e.g. from previous owners), we could fetch them here.
    // For now, let's stick to active contexts.

    return {
        success: true,
        data: flattened,
        customData,
        customDefinitions
    };
}
