"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ExtractedItem } from "./ai-mapper"; // Importing type
import { MasterSchemaDefinition } from "@/types/schema";
import { auth } from "@clerk/nextjs/server";

export async function createLegalEntity(data: { name: string; jurisdiction: string; clientOrgId: string }) {
    if (!data.name || !data.clientOrgId) {
        return { success: false, error: "Name and Client Org ID are required" };
    }

    try {
        const le = await prisma.clientLE.create({
            data: {
                name: data.name,
                jurisdiction: data.jurisdiction,
                clientOrgId: data.clientOrgId,
                status: "ACTIVE",
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
            const items = (q.extractedContent as any as ExtractedItem[]) || [];

            items.forEach(item => {
                if (item.type === "QUESTION" && item.masterKey) {
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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: {
                org: true, // The FI Organization
                questionnaires: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        mappings: true,
                        createdAt: true,
                        updatedAt: true
                        // Excluded: fileContent, extractedContent, rawText
                    }
                },
                clientLE: true // Context
            }
        });

        if (!engagement) {
            return { success: false, error: "Engagement not found" };
        }

        return {
            success: true,
            engagement,
            questionnaires: engagement.questionnaires
        };
    } catch (error) {
        console.error("Error fetching engagement details:", error);
        return { success: false, error: "Failed to fetch engagement details" };
    }
}

export async function createFIEngagement(clientLEId: string, fiName: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
                    members: {
                        create: {
                            userId: userId, // Temporarily creating user as member or leaving empty? 
                            // Better to just create the Org without members if it's an external stub.
                            // But schema might require members. Let's assume we can create it isolated.
                            // Actually schema says members: UserOrganizationRole[]. 
                            // Let's create it with the current user as an opportunistic "admin" or just leave members empty if possible.
                            // If schema allows members to be empty, great.
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
                status: "PENDING",
            }
        });

        revalidatePath(`/app/le/${clientLEId}/v2`);
        return { success: true, engagement };
    } catch (error) {
        console.error("Failed to create engagement:", error);
        return { success: false, error: "Failed to create engagement" };
    }
}
