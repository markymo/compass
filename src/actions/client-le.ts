"use server";

import prisma from "@/lib/prisma";
import { EngagementStatus, SourceType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ExtractedItem } from "./ai-mapper"; // Importing type
import { MasterSchemaDefinition } from "@/types/schema";
import { Action, can } from "@/lib/auth/permissions";
import { getMasterFieldDefinition, listAllMasterFields, listAllMasterGroupsWithItems } from "@/services/masterData/definitionService";
import { getIdentity } from "@/lib/auth";
import { getUserFIOrg, isSystemAdmin } from "./security";
import { calculateEngagementMetrics, calculateQuestionnaireMetrics } from "@/lib/metrics-calc";
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { KycStateService } from "@/lib/kyc/KycStateService";
import { enrichAddressReferences } from "@/actions/kyc-query";
import { resolveAmalgamatedAttachments } from "@/lib/kyc/attachments";
import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { getComplexFieldConfig } from "@/lib/master-data/complex-field-config";
import { toExportText } from "@/lib/export/toExportText";
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay } from "@/lib/master-data/field-interpreter";
import { compareAndLogShadowRender } from "@/lib/master-data/shadow-logger";
import { FieldDisplayModel } from "@/lib/master-data/field-display-model";
import * as Sentry from "@sentry/nextjs";
import { ensureNotReferenceSnapshot } from "./questionnaire";
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: Not logged in");

    const userWithMemberships = {
        id: identity.userId,
        memberships: await prisma.membership.findMany({ where: { userId: identity.userId } })
    };

    const hasAccess = await can(userWithMemberships, action, context, prisma);
    if (!hasAccess) throw new Error(`Unauthorized: Missing ${action} for context`);
}

export async function createLegalEntity(data: { name: string; jurisdiction: string; clientOrgId: string }) {
    if (!data.name || !data.clientOrgId) {
        return { success: false, error: "Name and Client Org ID are required" };
    }
    try {
        await ensureAuthorization(Action.LE_CREATE, { partyId: data.clientOrgId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Fetch Client Org name for AI Prompt
        const clientOrg = await prisma.organization.findUnique({
            where: { id: data.clientOrgId },
            select: { name: true }
        });

        // Generate preliminary description using AI
        let aiDescription = null;
        if (clientOrg) {
            const descResult = await generateLEDescription(clientOrg.name, data.name);
            if (descResult.success) {
                aiDescription = descResult.description;
            }
        }

        const le = await prisma.clientLE.create({
            data: {
                name: data.name,
                jurisdiction: data.jurisdiction,
                description: aiDescription,
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

            items.forEach((item: any) => {
                // Support both direct extraction schema and question schema
                // Question schema might have 'question' text but we look for 'masterKey' mapping

                // If it's the new question format, it might not have masterKey yet unless mapped.
                // But this code is specifically looking for "QUESTION" type and "masterKey".
                // Let's assume the new format items align or we skip them.

                if ((item.type || "").toLowerCase() === "question" && item.masterKey) {
                    const key = item.masterKey;

                    // Verify key exists in Master Schema
                    const fieldDef = allFields.find((f: any) => f.key === key);
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
    const fields = allFields.map((fieldDef: any) => {
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
    const filled = fields.filter((f: any) => f.currentValue !== undefined && f.currentValue !== "").length;

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
    try {
        // 1. Resolve fieldNo from the propertyKey (if numeric) or find in definitions
        let fieldNo = parseInt(propertyKey);
        if (isNaN(fieldNo)) {
            const allFields = await listAllMasterFields();
            const def = allFields.find((f: any) => (f as any).modelField === propertyKey || f.fieldName === propertyKey);
            if (!def) return { success: false, error: `Unknown property: ${propertyKey}` };
            fieldNo = def.fieldNo;
        }

        // 2. Resolve Subject and Scope
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId }
        });
        const subjectLeId = clientLE?.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        if (!subjectLeId) return { success: false, error: "Subject not resolved" };

        const def = await getMasterFieldDefinition(fieldNo);
        const claimInput: any = {
            fieldNo,
            subjectLeId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            sourceReference: "Manual UI Update",
            clientLEId, // enables graph write-back for fields with a MasterFieldGraphBinding
        };


        // Assign value to the correct slot
        switch (def.appDataType) {
            case 'TEXT': claimInput.valueText = payload.value; break;
            case 'NUMBER': claimInput.valueNumber = payload.value; break;
            case 'DATE':
            case 'DATETIME': claimInput.valueDate = new Date(payload.value); break;
            case 'PERSON_REF': claimInput.valuePersonId = payload.value; break;
            case 'ORG_REF': claimInput.valueLeId = payload.value; break;
            case 'DOCUMENT_REF': claimInput.valueDocId = payload.value; break;
            case 'ADDRESS_REF': claimInput.valueAddressId = payload.value; break;
            case 'PARTY_REF':
                // payload.value is expected to be an object for polymorphic types: { type: 'PERSON' | 'LEGAL_ENTITY', id: '123' }
                if (typeof payload.value === 'object' && payload.value !== null) {
                    if (payload.value.type === 'PERSON') {
                        claimInput.valuePersonId = payload.value.id;
                    } else if (payload.value.type === 'LEGAL_ENTITY') {
                        claimInput.valueLeId = payload.value.id;
                    }
                }
                break;
            case 'PARTY':
            case 'PERSON_OR_CONTACT':
            case 'JSONB': claimInput.valueJson = payload.value; break;
        }

        const claim = await FieldClaimService.assertClaim(claimInput);

        // If status is provided, and it's VERIFIED, we can auto-verify (for legacy compatibility)
        if (payload.status === "VERIFIED") {
            await FieldClaimService.verifyClaim(claim.id, "SYSTEM_USER");
        }

        revalidatePath(`/app/le/${clientLEId}`);
        return {
            success: true,
            propertyData: {
                value: payload.value,
                status: payload.status || "VERIFIED",
                updatedAt: new Date().toISOString()
            }
        };
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
                        dueDate: true,
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
                        dueDate: true,
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
        const combinedQuestionnairesRaw = Array.from(
            new Map(
                [...engagement.questionnaireInstances, ...engagement.questionnaires].map((item: any) => [item.id, item])
            ).values()
        );

        // Fetch metrics for each questionnaire
        const questionnaires = await Promise.all(combinedQuestionnairesRaw.map(async (q: any) => ({
            ...q,
            metrics: await calculateQuestionnaireMetrics(q.id)
        })));

        // Fetch Pending Invitations
        const rawInvitations = await prisma.invitation.findMany({
            where: {
                fiEngagementId: engagementId,
                usedAt: null,
                revokedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });

        // Manually fetch and attach the creator User details (no direct relation in schema)
        const creatorIds = [...new Set(rawInvitations.map((inv: any) => inv.createdByUserId))];
        const creators = await prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, name: true, email: true }
        });

        const invitations = rawInvitations.map((inv: any) => ({
            ...inv,
            createdByUser: creators.find((c: any) => c.id === inv.createdByUserId) || null
        }));

        // Fetch Active Members (Scoped to the LE for now, as Suppliers are invited to the LE or Org)
        const members = await prisma.membership.findMany({
            where: { clientLEId: engagement.clientLEId },
            include: { user: { select: { name: true, email: true, image: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate Metrics
        const metrics = await calculateEngagementMetrics(engagementId);

        return {
            success: true,
            engagement,
            questionnaires,
            invitations,
            members,
            metrics
        };
    } catch (error) {
        console.error("Error fetching engagement details:", error);
        return { success: false, error: "Failed to fetch engagement details" };
    }
}

export async function createFIEngagement(clientLEId: string, fiOrgId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // 1. Verify the selected Organization exists by ID
        const fiOrg = await prisma.organization.findUnique({
            where: { id: fiOrgId }
        });

        if (!fiOrg) {
            return { success: false, error: "Organization not found" };
        }

        if (!fiOrg.types.includes("FI")) {
            return { success: false, error: "Selected organization is not a financial institution" };
        }

        // 2. Check for Existing Engagement using canonical composite key [fiOrgId, clientLEId]
        const existingEngagement = await prisma.fIEngagement.findUnique({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: fiOrg.id,
                    clientLEId: clientLEId
                }
            },
            include: { org: true }
        });

        if (existingEngagement) {
            // Case A: Existing soft-deleted engagement -> Reactivate existing record
            if (existingEngagement.isDeleted) {
                const restored = await prisma.fIEngagement.update({
                    where: { id: existingEngagement.id },
                    data: { isDeleted: false, status: EngagementStatus.INVITED },
                    include: { org: true }
                });
                revalidatePath(`/app/le/${clientLEId}/relationships`);
                revalidatePath(`/app/le/${clientLEId}/v2`);
                return { success: true, engagement: restored, actionType: "RESTORED" };
            }

            // Case B: Existing active engagement -> Return explicit ALREADY_EXISTS status
            return {
                success: true,
                engagement: existingEngagement,
                actionType: "ALREADY_EXISTS",
                message: `Relationship with ${fiOrg.name} is already active.`
            };
        }

        // 3. Create New Engagement
        const engagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLEId,
                fiOrgId: fiOrg.id,
                status: EngagementStatus.PREPARATION,
                activities: {
                    create: {
                        userId: userId,
                        type: "INVITE_SENT",
                        details: { fiName: fiOrg.name }
                    }
                }
            },
            include: { org: true }
        });

        revalidatePath(`/app/le/${clientLEId}/relationships`);
        revalidatePath(`/app/le/${clientLEId}/v2`);
        return { success: true, engagement, actionType: "CREATED" };
    } catch (e: any) {
        console.error("Create FI Engagement Failed", e);
        return { success: false, error: e.message || "Failed to create engagement" };
    }
}

/**
 * Fetches all Master Data values for an LE, flattened by Field Number.
 * This is used for the Questionnaire Mapper to show existing values.
 */
export async function getFullMasterData(clientLEId: string) {
    if (!clientLEId) return { success: false, data: {} };

    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, data: {} };
    const { userId } = identity;

    const sysAdmin = await isSystemAdmin();

    // 1. Authorization check using central engine
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: {
            organizationId: true,
            clientLEId: true,
            fiEngagementId: true,
            role: true,
            clientLE: { select: { isDeleted: true, status: true } }
        }
    });

    const allowed = await can({ id: userId, memberships }, Action.LE_VIEW_MASTER_DATA, { clientLEId }, prisma);
    if (!allowed && !sysAdmin) {
        return { success: false, data: {} };
    }

    // 2. Fetch ClientLE (link to LegalEntity), filtering deleted unless SysAdmin
    const clientLE = await prisma.clientLE.findFirst({
        where: {
            id: clientLEId,
            ...(sysAdmin ? {} : { isDeleted: false, status: { not: "ARCHIVED" } })
        },
        include: {
            legalEntity: true,
            registryReferences: {
                include: { authority: true },
                orderBy: { updatedAt: 'desc' }
            }
        }
    });

    if (!clientLE) return { success: false, data: {} };


    // 2. Resolve Subject and Scope
    const subjectLeId = clientLE.legalEntityId;
    const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

    const masterFieldAssignmentsMap: Record<number, any> = {};

    const flattened: Record<number, { 
        value: any, 
        formattedDisplayValue?: string,
        source?: string, 
        sourceReference?: string,
        displayState: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE",
        defaultResponse?: string,
        mappingStats?: { questions: number, questionnaires: number, suppliers: number },
        canonicalDisplayModel?: FieldDisplayModel,
        assignment?: any
    }> = {};

    const allMappings = await prisma.sourceFieldMapping.findMany({
        where: { isActive: true },
        select: { targetFieldNo: true, sourceType: true, sourceReference: true }
    });
    const mappingsByField = new Map<number, string[]>();
    for (const m of allMappings) {
        const list = mappingsByField.get(m.targetFieldNo) || [];
        list.push(m.sourceType);
        mappingsByField.set(m.targetFieldNo, list);
    }

    if (subjectLeId) {
        const allFields = await listAllMasterFields();

        // Batch fetch master field assignments for this Legal Entity
        const assignmentsRaw = ((prisma as any).masterFieldAssignment?.findMany)
            ? await (prisma as any).masterFieldAssignment.findMany({
                where: { clientLEId },
                include: {
                    assignedUser: { select: { id: true, name: true, email: true } },
                    assignedByUser: { select: { id: true, name: true, email: true } }
                }
            })
            : [];
        for (const a of assignmentsRaw) {
            masterFieldAssignmentsMap[a.fieldNo] = {
                id: a.id,
                assignedToUserId: a.assignedToUserId,
                assignedByUserId: a.assignedByUserId,
                note: a.note || null,
                status: a.status || 'OPEN',
                createdAt: a.createdAt,
                assignedUser: a.assignedUser,
                assignedByUser: a.assignedByUser
            };
        }

        // Fetch usage stats (Questions, Questionnaires, Suppliers) across all questionnaires assigned to this LE
        const stats = await prisma.$queryRaw<{masterFieldNo: number, questions: bigint, questionnaires: bigint, suppliers: bigint}[]>`
            WITH client_questionnaires AS (
                -- 1. Direct fiEngagementId
                SELECT qn.id AS qn_id, e."fiOrgId" AS supplier_id
                FROM "Questionnaire" qn
                JOIN "FIEngagement" e ON qn."fiEngagementId" = e.id
                WHERE e."clientLEId" = ${clientLEId}
                  AND e."isDeleted" = false
                  AND e."status" != 'ARCHIVED'
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false

                UNION

                -- 2. m2m engagements relation (_FIEngagementToQuestionnaire)
                SELECT qn.id AS qn_id, e."fiOrgId" AS supplier_id
                FROM "Questionnaire" qn
                JOIN "_FIEngagementToQuestionnaire" eq ON qn.id = eq."B"
                JOIN "FIEngagement" e ON eq."A" = e.id
                WHERE e."clientLEId" = ${clientLEId}
                  AND e."isDeleted" = false
                  AND e."status" != 'ARCHIVED'
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false

                UNION

                -- 3. Common questionnaires linked to ClientLE (_ClientCommonQuestionnaires)
                SELECT qn.id AS qn_id, qn."fiOrgId" AS supplier_id
                FROM "Questionnaire" qn
                JOIN "_ClientCommonQuestionnaires" ccq ON qn.id = ccq."B"
                WHERE ccq."A" = ${clientLEId}
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false
            )
            SELECT 
                q."masterFieldNo",
                COUNT(q.id) as questions,
                COUNT(DISTINCT cq.qn_id) as questionnaires,
                COUNT(DISTINCT cq.supplier_id) as suppliers
            FROM "Question" q
            JOIN client_questionnaires cq ON q."questionnaireId" = cq.qn_id
            WHERE q."masterFieldNo" IS NOT NULL
            GROUP BY q."masterFieldNo"
        `;

        const mappingStatsMap = new Map<number, { questions: number, questionnaires: number, suppliers: number }>();
        for (const row of stats) {
            mappingStatsMap.set(row.masterFieldNo, {
                questions: Number(row.questions),
                questionnaires: Number(row.questionnaires),
                suppliers: Number(row.suppliers)
            });
        }

        const resolved = await Sentry.startSpan(
            { name: "master.resolveAllFields", op: "function.data" },
            async () => KycStateService.resolveAllFields(
                { subjectLeId, clientLEId: clientLE.id },
                allFields.map(d => {
                    const cfg = getComplexFieldConfig(d.fieldNo);
                    return {
                        fieldNo: d.fieldNo,
                        isMultiValue: d.isMultiValue,
                        collectionId: d.isMultiValue
                            ? (cfg?.kind === 'STRUCTURED_COLLECTION' ? cfg.collectionId : undefined)
                            : undefined,
                    };
                }),
                ownerScopeId || undefined
            )
        );

        const fieldsWithAttachments = allFields.filter(f => f.allowAttachments).map(f => f.fieldNo);
        const resolvedAttachments = await Sentry.startSpan(
            { name: "master.resolveAttachments", op: "function.data" },
            async () => resolveAmalgamatedAttachments(
                { subjectLeId, clientLEId: clientLE.id },
                fieldsWithAttachments,
                resolved
            )
        );

        const ccPartyIds = new Set<string>();
        for (const val of Array.from(resolved.values())) {
            if (!val) continue;
            const claims = Array.isArray(val) ? val : [val];
            for (const c of claims) {
                if (c.value?.ccPartyId) ccPartyIds.add(c.value.ccPartyId);
            }
        }

        const partyMap = new Map<string, any>();
        if (ccPartyIds.size > 0) {
            const parties = await Sentry.startSpan(
                { name: "master.resolveParties", op: "function.data" },
                async () => prisma.cCParty.findMany({
                    where: { id: { in: Array.from(ccPartyIds) } }
                })
            );
            for (const p of parties) {
                partyMap.set(p.id, p);
            }
        }

        const resolvePartyRef = (v: any) => {
            if (v?.ccPartyId) {
                const party = partyMap.get(v.ccPartyId);
                if (party?.data) {
                    v._resolvedData = v._resolvedData || {};
                    v._resolvedData.ccParty = party;
                    return party.data;
                }
            }
            return v;
        };

        const claimValuesFlat: any[] = [];
        for (const val of Array.from(resolved.values())) {
            if (!val) continue;
            if (Array.isArray(val)) {
                for (const c of val) {
                    if (c.value) claimValuesFlat.push(c.value);
                }
            } else if (val.value) {
                claimValuesFlat.push(val.value);
            }
        }
        await Sentry.startSpan(
            { name: "master.resolveAddresses", op: "function.data" },
            async () => enrichAddressReferences(claimValuesFlat)
        );

        await Sentry.startSpan(
            { name: "master.interpreterLoop", op: "function.loop" },
            async (loopSpan) => {
                let claimsCount = 0;
                let displayModelsCount = 0;
                let stateCheckMs = 0;
                let modelConstructMs = 0;
                let toExportTextMs = 0;

                for (const def of allFields) {
                    const val = resolved.get(def.fieldNo);
                    let valueToSet: any = null;
                    let sourceToSet: string | undefined = undefined;
                    let sourceRefToSet: string | undefined = undefined;
                    let timestampToSet: Date | undefined = undefined;
                    let sourceCheckedAtToSet: Date | undefined = undefined;

                    if (val !== null && val !== undefined) {
                        if (Array.isArray(val)) {
                            claimsCount += val.length;
                            if (val.length > 0) {
                                valueToSet = val.map((c: any) => ({
                                    value: resolvePartyRef(c.value),
                                    source: c.sourceType ? {
                                        type: c.sourceType,
                                        reference: c.sourceReference || null,
                                        timestamp: c.assertedAt || null,
                                        sourceCheckedAt: c.sourceCheckedAt || null
                                    } : undefined,
                                    instanceId: c.instanceId
                                }));
                                sourceToSet = val[0].isScoped ? 'USER_INPUT' : (val[0].evidenceProvider || val[0].sourceType || 'MASTER_RECORD');
                            }
                        } else {
                            claimsCount += 1;
                            valueToSet = resolvePartyRef(val.value);
                            sourceToSet = val.isScoped ? 'USER_INPUT' : (val.evidenceProvider || val.sourceType || 'MASTER_RECORD');
                            sourceRefToSet = val.sourceReference ?? undefined;
                            timestampToSet = val.assertedAt || undefined;
                            sourceCheckedAtToSet = val.sourceCheckedAt || undefined;
                        }
                    }

                    const t0 = performance.now();
                    const interpreterState = def.isMultiValue 
                        ? resolveFieldCollectionForDisplay(valueToSet || [], { isMultiValue: true } as any).state
                        : resolveFieldForDisplay(valueToSet, null, { isMultiValue: false } as any).state;
                    const t1 = performance.now();
                    stateCheckMs += (t1 - t0);

                    const hasValue = interpreterState === 'POPULATED' || interpreterState === 'EXPLICIT_NONE';
                    const mappingsForField = allMappings.filter((m: any) => m.targetFieldNo === def.fieldNo);
                    const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappingsForField);
                    
                    const displayState = KycStateService.calculateDisplayState({
                        hasValue,
                        hasApplicableMapping: evalResult.hasApplicableMapping,
                        hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
                        defaultText: def.defaultResponse ?? undefined
                    });

                    if (!hasValue && evalResult.evaluatedSourceBadge) {
                        sourceToSet = evalResult.evaluatedSourceBadge;
                        if (evalResult.evaluatedSourceTimestamp) {
                            sourceCheckedAtToSet = sourceCheckedAtToSet || evalResult.evaluatedSourceTimestamp;
                        }
                    }

                    const rawSource = sourceToSet ? {
                        type: sourceToSet,
                        reference: sourceRefToSet,
                        timestamp: timestampToSet || null,
                        sourceCheckedAt: sourceCheckedAtToSet || null,
                        userName: null
                    } : null;

                    const t2 = performance.now();
                    const displayModel = def.isMultiValue ? 
                        resolveFieldCollectionForDisplay(
                            valueToSet || [],
                            {
                                fieldNo: def.fieldNo,
                                label: def.fieldName,
                                defaultText: def.defaultResponse || undefined,
                                displayState,
                                isEditable: true,
                                isMultiValue: true,
                                appDataType: def.appDataType,
                                profileConfig: def.profileConfig as { displayMask?: string[] } | undefined,
                                codeSystem: (() => {
                                    const cfg = getComplexFieldConfig(def.fieldNo);
                                    return cfg?.kind === 'STRUCTURED_COLLECTION' ? (cfg as any).codeSystem : undefined;
                                })(),
                                allowAttachments: def.allowAttachments,
                                attachments: resolvedAttachments.get(def.fieldNo) || [],
                                clientLEId,
                                rawSource
                            }
                        ) : resolveFieldForDisplay(
                            valueToSet,
                            rawSource,
                            {
                                fieldNo: def.fieldNo,
                                label: def.fieldName,
                                defaultText: def.defaultResponse || undefined,
                                displayState,
                                isEditable: true,
                                isMultiValue: false,
                                appDataType: def.appDataType,
                                profileConfig: def.profileConfig as { displayMask?: string[] } | undefined,
                                codeSystem: (() => {
                                    const cfg = getComplexFieldConfig(def.fieldNo);
                                    return cfg?.kind === 'STRUCTURED_COLLECTION' ? (cfg as any).codeSystem : undefined;
                                })(),
                                allowAttachments: def.allowAttachments,
                                attachments: resolvedAttachments.get(def.fieldNo) || [],
                                clientLEId
                            }
                        );
                    const t3 = performance.now();
                    modelConstructMs += (t3 - t2);
                    displayModelsCount += 1;

                    const t4 = performance.now();
                    const oldFormattedDisplayValue = toExportText(displayModel);
                    const t5 = performance.now();
                    toExportTextMs += (t5 - t4);

                    flattened[def.fieldNo] = {
                        value: valueToSet,
                        formattedDisplayValue: oldFormattedDisplayValue,
                        source: sourceToSet,
                        sourceReference: sourceRefToSet,
                        displayState,
                        defaultResponse: def.defaultResponse ?? undefined,
                        mappingStats: mappingStatsMap.get(def.fieldNo) || { questions: 0, questionnaires: 0, suppliers: 0 },
                        canonicalDisplayModel: displayModel,
                        assignment: masterFieldAssignmentsMap[def.fieldNo] || null
                    };
                }

                let totalAttachmentsCount = 0;
                for (const atts of Array.from(resolvedAttachments.values())) {
                    totalAttachmentsCount += atts.length;
                }

                loopSpan?.setAttribute("masterFields.count", allFields.length);
                loopSpan?.setAttribute("claims.count", claimsCount);
                loopSpan?.setAttribute("displayModels.count", displayModelsCount);
                loopSpan?.setAttribute("parties.count", partyMap.size);
                loopSpan?.setAttribute("attachments.count", totalAttachmentsCount);
                loopSpan?.setAttribute("interpreterLoop.stateCheckMs", Math.round(stateCheckMs * 100) / 100);
                loopSpan?.setAttribute("interpreterLoop.modelConstructMs", Math.round(modelConstructMs * 100) / 100);
                loopSpan?.setAttribute("interpreterLoop.toExportTextMs", Math.round(toExportTextMs * 100) / 100);
            }
        );

    }

    const { customData, customDefinitions } = await Sentry.startSpan(
        { name: "master.customData", op: "function.data" },
        async (customSpan) => {
            const rawCustomData = (clientLE.customData as Record<string, any>) || {};
            let rawCustomDefs: any[] = [];

            const owner = await prisma.clientLEOwner.findFirst({
                where: { clientLEId, endAt: null },
                orderBy: { startAt: 'asc' }
            });

            const userFI = await getUserFIOrg();

            const targetOrgIds = new Set<string>();
            if (owner) targetOrgIds.add(owner.partyId);
            if (userFI) targetOrgIds.add(userFI.id);

            const targetDefIds = new Set<string>();
            Object.keys(rawCustomData).forEach((key: any) => {
                if (key.length > 20) targetDefIds.add(key);
            });

            if (targetOrgIds.size > 0 || targetDefIds.size > 0) {
                rawCustomDefs = await prisma.customFieldDefinition.findMany({
                    where: {
                        OR: [
                            { orgId: { in: Array.from(targetOrgIds) } },
                            { id: { in: Array.from(targetDefIds) } }
                        ],
                        isDeleted: false
                    },
                    orderBy: { label: 'asc' }
                });
            }

            customSpan?.setAttribute("customFields.count", (rawCustomDefs || []).length);

            return { customData: rawCustomData, customDefinitions: rawCustomDefs };
        }
    );

    const gleifLastSynced: Date | null = clientLE.gleifFetchedAt;

    let nationalRegistryData = null;
    let computedEnrichmentStatus = 'PENDING_LEI';

    if (clientLE.registryReferences && clientLE.registryReferences.length > 0) {
        const primaryRef = clientLE.registryReferences[0];
        nationalRegistryData = {
            id: primaryRef.id,
            authorityName: primaryRef.authority.name,
            localRegistrationNumber: primaryRef.localRegistrationNumber,
            lastSyncSucceededAt: primaryRef.lastSyncSucceededAt,
            lastSyncStatus: primaryRef.lastSyncStatus
        };

        if (primaryRef.lastSyncStatus === 'SUCCESS') {
            computedEnrichmentStatus = 'ENRICHED';
        } else if (primaryRef.lastSyncStatus === 'FAILED') {
            computedEnrichmentStatus = 'FAILED';
        } else {
            computedEnrichmentStatus = 'PENDING_ENRICHMENT';
        }
    } else if (clientLE.gleifFetchedAt || clientLE.legalEntity?.lei || clientLE.status === 'ACTIVE') {
        computedEnrichmentStatus = 'ENRICHED';
    }

    return {
        success: true,
        data: flattened,
        customData,
        customDefinitions,
        gleifLastSynced,
        nationalRegistryData,
        enrichmentStatus: computedEnrichmentStatus,
        lei: clientLE.legalEntity?.lei,
        registrationAuthorityId: clientLE.registryReferences?.[0]?.authority?.id ?? undefined,
        masterFields: await listAllMasterFields(),
        masterGroups: await listAllMasterGroupsWithItems(),
        masterFieldAssignments: masterFieldAssignmentsMap
    };

}

import { generateLEDescription } from "./ai-actions";

export async function updateLEDueDate(leId: string, dueDate: Date | null) {
    try {
        await prisma.clientLE.update({
            where: { id: leId },
            data: { dueDate }
        });
        revalidatePath(`/app/le/${leId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to update LE due date:", error);
        return { success: false, error: "Database update failed" };
    }
}

export async function updateEngagementDueDate(engagementId: string, dueDate: Date | null) {
    try {
        const engagement = await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: { dueDate },
            include: { clientLE: true }
        });
        revalidatePath(`/app/le/${engagement.clientLEId}/engagement-new/${engagementId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to update engagement due date:", error);
        return { success: false, error: "Database update failed" };
    }
}

export async function updateQuestionnaireDueDate(questionnaireId: string, dueDate: Date | null) {
    try { await ensureNotReferenceSnapshot(questionnaireId); } catch(e: any) { return { success: false, error: e.message }; }
    try {
        const questionnaire = await prisma.questionnaire.update({
            where: { id: questionnaireId },
            data: { dueDate },
            include: { fiEngagement: true }
        });
        if (questionnaire.fiEngagement) {
            revalidatePath(`/app/le/${questionnaire.fiEngagement.clientLEId}/engagement-new/${questionnaire.fiEngagementId}`);
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to update questionnaire due date:", error);
        return { success: false, error: "Database update failed" };
    }
}

export async function getAvailableCommonQuestionnaires(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        let partyId: string | undefined;

        const owner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId, endAt: null },
            orderBy: { startAt: 'asc' }
        });

        if (owner) {
            partyId = owner.partyId;
        } else {
            const anyOwner = await prisma.clientLEOwner.findFirst({
                where: { clientLEId },
                orderBy: { createdAt: 'desc' }
            });
            if (anyOwner) {
                partyId = anyOwner.partyId;
            } else {
                const membership = await prisma.membership.findFirst({
                    where: { clientLEId, organizationId: { not: null } }
                });
                if (membership?.organizationId) {
                    partyId = membership.organizationId;
                } else {
                    const userMembership = await prisma.membership.findFirst({
                        where: { userId: identity.userId, organizationId: { not: null } }
                    });
                    if (userMembership?.organizationId) {
                        partyId = userMembership.organizationId;
                    }
                }
            }
        }

        const { getDiscoverableReferenceSnapshotsForOrg } = await import("@/actions/questionnaires-v2");
        let snapshots = await getDiscoverableReferenceSnapshotsForOrg(partyId);

        // Fallback: If no REFERENCE_SNAPSHOTs exist, query global/template questionnaires
        if (!snapshots || snapshots.length === 0) {
            const templates = await prisma.questionnaire.findMany({
                where: {
                    isDeleted: false,
                    status: { not: "ARCHIVED" },
                    OR: [
                        { isGlobal: true },
                        { isTemplate: true },
                        { kind: "REFERENCE_SNAPSHOT" },
                        { kind: "COMMON_QUESTIONNAIRE" },
                    ]
                },
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    functionalCode: true,
                    referenceCode: true,
                    questions: { select: { id: true } }
                }
            });

            snapshots = templates.map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                functionalCode: t.functionalCode,
                referenceCode: t.referenceCode,
                questionCount: t.questions.length,
                visibility: "GLOBAL" as any,
                ownerOrgId: null,
                ownerOrgName: "System",
                updatedAt: new Date(),
                createdAt: new Date(),
            }));
        }

        return { success: true, snapshots };
    } catch (error) {
         console.error("Error fetching available questionnaires:", error);
         return { success: false, error: "Failed to fetch" };
    }
}

export async function getLinkedCommonQuestionnaires(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: {
                commonQuestionnaires: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        visibility: true,
                        referenceCode: true
                    }
                }
            }
        });

        if (!clientLE) return { success: false, error: "Client not found" };

        return { success: true, questionnaires: clientLE.commonQuestionnaires };
    } catch (error) {
        console.error("Failed to fetch common questionnaires:", error);
        return { success: false, error: "Database error" };
    }
}

export async function addCommonQuestionnaire(clientLEId: string, questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const template = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            include: { questions: true }
        });

        if (!template) return { success: false, error: "Questionnaire not found" };

        const clientLe = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { shortCode: true }
        });

        let instanceReferenceCode = template.referenceCode;
        if (template.kind === "REFERENCE_SNAPSHOT" && template.referenceCode) {
            const { normalizeCode } = await import("@/lib/questionnaires/reference-codes");
            const leCode = clientLe?.shortCode ? normalizeCode(clientLe.shortCode) : "XXXXX";
            
            const contextualPrefix = template.referenceCode
                .replace(/_v\d+$/, "")                      // drop template's _v{n}
                .replace(/_(XXXXX)(?=_|$)/, `_${leCode}`)  // substitute LE
                .replace(/_(S{4,})(?=_|$)/, `_COMMON`);    // substitute supplier with COMMON
            
            // Check for uniqueness within this client's common questionnaires
            const existingInstances = await prisma.questionnaire.findMany({
                where: {
                    commonForClients: { some: { id: clientLEId } },
                    referenceCode: { startsWith: contextualPrefix }
                },
                select: { referenceCode: true }
            });
            
            const existingCodes = existingInstances.map((q: any) => q.referenceCode).filter(Boolean) as string[];
            
            if (!existingCodes.includes(contextualPrefix)) {
                instanceReferenceCode = contextualPrefix;
            } else {
                const { computeNextVersion } = await import("@/lib/questionnaires/reference-codes");
                let nextVersion = computeNextVersion(contextualPrefix, existingCodes);
                if (nextVersion === 1) nextVersion = 2; // if exact prefix exists but no suffixes, next is 2
                instanceReferenceCode = `${contextualPrefix}_v${nextVersion}`;
            }
        } else if (template.functionalCode) {
            const { generateWorkingCopyTitle } = await import("@/lib/questionnaires/reference-codes");
            instanceReferenceCode = generateWorkingCopyTitle({
                functionalCode: template.functionalCode,
                clientLeShortCode: clientLe?.shortCode,
                supplierShortCode: "COMMON",
            });
        }

        let instanceName = template.name;
        if (!instanceName || instanceName === template.referenceCode || instanceName.includes("XXXXX") || instanceName.includes("SSSSS")) {
            instanceName = instanceReferenceCode || template.name;
        }

        const now = new Date();
        const userId = identity.userId;

        // Fallback target fiOrgId if template.fiOrgId is missing
        let targetFiOrgId = template.fiOrgId;
        if (!targetFiOrgId) {
            targetFiOrgId = template.ownerOrgId || undefined;
        }
        if (!targetFiOrgId) {
            const owner = await prisma.clientLEOwner.findFirst({
                where: { clientLEId, endAt: null }
            });
            targetFiOrgId = owner?.partyId;
        }
        if (!targetFiOrgId) {
            const anyOrg = await prisma.organization.findFirst({ select: { id: true } });
            if (!anyOrg?.id) {
                return { success: false, error: "No organization found to assign questionnaire" };
            }
            targetFiOrgId = anyOrg.id;
        }

        const newQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: instanceName,
                fiOrgId: targetFiOrgId,
                status: "ACTIVE",
                extractedContent: template.extractedContent as any,
                kind: "COMMON_QUESTIONNAIRE", 
                isTemplate: false,
                isGlobal: false,
                sourceId: questionnaireId,
                referenceCode: instanceReferenceCode,
                commonForClients: {
                    connect: { id: clientLEId }
                },
                questions: {
                    create: template.questions.map((q: any) => ({
                        text: q.text,
                        compactText: q.compactText,
                        order: q.order,
                        status: "SHARED",
                        sharedAt: now,
                        sharedByUserId: userId,
                        sourceSectionId: q.sourceSectionId,
                        masterFieldNo: q.masterFieldNo,
                        masterQuestionGroupId: q.masterQuestionGroupId,
                        customFieldDefinitionId: q.customFieldDefinitionId,
                    }))
                }
            }
        });

        revalidatePath(`/app/le/${clientLEId}`);
        revalidatePath(`/app/le/${clientLEId}/relationships`);
        return { success: true };
    } catch (error) {
        console.error("Failed to link common questionnaire:", error);
        return { success: false, error: "Database error" };
    }
}

export async function removeCommonQuestionnaire(clientLEId: string, questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        await prisma.clientLE.update({
            where: { id: clientLEId },
            data: {
                commonQuestionnaires: {
                    disconnect: { id: questionnaireId }
                }
            }
        });

        // If it's a local clone (not global), soft-delete it to prevent orphans
        const q = await prisma.questionnaire.findUnique({ where: { id: questionnaireId } });
        if (q && !q.isGlobal) {
            await prisma.questionnaire.update({
                where: { id: questionnaireId },
                data: { isDeleted: true }
            });
        }

        revalidatePath(`/app/le/${clientLEId}`);
        revalidatePath(`/app/le/${clientLEId}/relationships`);
        return { success: true };
    } catch (error) {
        console.error("Failed to remove common questionnaire:", error);
        return { success: false, error: "Database error" };
    }
}

export async function getEngagementTeam(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            select: { clientLEId: true }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };

        const rawInvitations = await prisma.invitation.findMany({
            where: {
                fiEngagementId: engagementId,
                usedAt: null,
                revokedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });

        const creatorIds = [...new Set(rawInvitations.map((inv: any) => inv.createdByUserId))];
        const creators = await prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, name: true, email: true }
        });

        const invitations = rawInvitations.map((inv: any) => ({
            ...inv,
            createdByUser: creators.find((c: any) => c.id === inv.createdByUserId) || null
        }));

        const members = await prisma.membership.findMany({
            where: { clientLEId: engagement.clientLEId },
            include: { user: { select: { name: true, email: true, image: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, invitations, members };
    } catch (error) {
        return { success: false, error: "Failed to fetch team details" };
    }
}

export async function getEngagementDocuments(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: {
                sharedDocuments: {
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };
        
        const { getEngagementEvidenceDocuments } = await import("./kanban-actions");
        const evidenceResult = await getEngagementEvidenceDocuments(engagementId);

        return { 
            success: true, 
            clientLEId: engagement.clientLEId,
            sharedDocuments: engagement.sharedDocuments,
            evidenceDocuments: evidenceResult.documents || []
        };
    } catch (error) {
        return { success: false, error: "Failed to fetch document details" };
    }
}

export interface RelationshipQuestionnaireGroup {
    questionnaireId: string;
    questionnaireName: string;
    questions: Array<{ id: string; text: string }>;
}

export interface RelationshipUsageGroup {
    supplierId: string;
    supplierName: string;
    supplierCode?: string;
    questionnaires: RelationshipQuestionnaireGroup[];
}

export interface FieldUsageDetails {
    totalQuestions: number;
    totalQuestionnaires: number;
    totalSuppliers: number;
    relationships: RelationshipUsageGroup[];
    questions: Array<{
        id: string;
        text: string;
        questionnaireId: string;
        questionnaireName: string;
        supplierName?: string;
    }>;
    questionnaires: Array<{
        id: string;
        name: string;
        supplierName?: string;
    }>;
    suppliers: Array<{
        id: string;
        name: string;
        shortCode?: string;
    }>;
}

export async function getFieldUsageDetails(
    clientLEId: string,
    masterFieldNo?: number,
    customFieldId?: string
): Promise<FieldUsageDetails> {
    if (!clientLEId || (!masterFieldNo && !customFieldId)) {
        return { totalQuestions: 0, totalQuestionnaires: 0, totalSuppliers: 0, relationships: [], questions: [], questionnaires: [], suppliers: [] };
    }

    try {
        const fieldCondition = masterFieldNo
            ? Prisma.sql`q."masterFieldNo" = ${masterFieldNo}`
            : Prisma.sql`q."customFieldDefinitionId" = ${customFieldId}`;

        const rows = await prisma.$queryRaw<Array<{
            question_id: string;
            question_text: string;
            qn_id: string;
            qn_name: string;
            supplier_id: string;
            supplier_name: string | null;
            supplier_code: string | null;
        }>>`
            WITH client_questionnaires AS (
                -- 1. Direct fiEngagementId
                SELECT qn.id AS qn_id, qn.name AS qn_name, e."fiOrgId" AS supplier_id, org.name AS supplier_name, org."shortCode" AS supplier_code
                FROM "Questionnaire" qn
                JOIN "FIEngagement" e ON qn."fiEngagementId" = e.id
                JOIN "Organization" org ON e."fiOrgId" = org.id
                WHERE e."clientLEId" = ${clientLEId}
                  AND e."isDeleted" = false
                  AND e."status" != 'ARCHIVED'
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false

                UNION

                -- 2. m2m engagements relation (_FIEngagementToQuestionnaire)
                SELECT qn.id AS qn_id, qn.name AS qn_name, e."fiOrgId" AS supplier_id, org.name AS supplier_name, org."shortCode" AS supplier_code
                FROM "Questionnaire" qn
                JOIN "_FIEngagementToQuestionnaire" eq ON qn.id = eq."B"
                JOIN "FIEngagement" e ON eq."A" = e.id
                JOIN "Organization" org ON e."fiOrgId" = org.id
                WHERE e."clientLEId" = ${clientLEId}
                  AND e."isDeleted" = false
                  AND e."status" != 'ARCHIVED'
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false

                UNION

                -- 3. Common questionnaires linked to ClientLE (_ClientCommonQuestionnaires)
                SELECT qn.id AS qn_id, qn.name AS qn_name, qn."fiOrgId" AS supplier_id, org.name AS supplier_name, org."shortCode" AS supplier_code
                FROM "Questionnaire" qn
                JOIN "_ClientCommonQuestionnaires" ccq ON qn.id = ccq."B"
                JOIN "Organization" org ON qn."fiOrgId" = org.id
                WHERE ccq."A" = ${clientLEId}
                  AND qn."isDeleted" = false
                  AND qn."isTemplate" = false
            )
            SELECT 
                q.id AS question_id,
                q.text AS question_text,
                cq.qn_id,
                cq.qn_name,
                cq.supplier_id,
                cq.supplier_name,
                cq.supplier_code
            FROM "Question" q
            JOIN client_questionnaires cq ON q."questionnaireId" = cq.qn_id
            WHERE ${fieldCondition}
        `;

        const relMap = new Map<string, RelationshipUsageGroup>();
        const questionsMap = new Map<string, FieldUsageDetails['questions'][0]>();
        const questionnairesMap = new Map<string, FieldUsageDetails['questionnaires'][0]>();
        const suppliersMap = new Map<string, FieldUsageDetails['suppliers'][0]>();

        for (const row of rows) {
            let sId = row.supplier_id || "common";
            let sName = row.supplier_name || "Common Questionnaires";
            let sCode = row.supplier_code || undefined;

            if (sName === "System" || sId === "common") {
                sName = "Common Questionnaires";
                sCode = "COMMON";
                sId = "common";
            }

            let rel = relMap.get(sId);
            if (!rel) {
                rel = {
                    supplierId: sId,
                    supplierName: sName,
                    supplierCode: sCode,
                    questionnaires: []
                };
                relMap.set(sId, rel);
            }

            let qnGroup = rel.questionnaires.find(q => q.questionnaireId === row.qn_id);
            if (!qnGroup) {
                qnGroup = {
                    questionnaireId: row.qn_id,
                    questionnaireName: row.qn_name,
                    questions: []
                };
                rel.questionnaires.push(qnGroup);
            }

            if (row.question_id && !qnGroup.questions.some(q => q.id === row.question_id)) {
                qnGroup.questions.push({
                    id: row.question_id,
                    text: row.question_text
                });
            }

            if (row.question_id && !questionsMap.has(row.question_id)) {
                questionsMap.set(row.question_id, {
                    id: row.question_id,
                    text: row.question_text,
                    questionnaireId: row.qn_id,
                    questionnaireName: row.qn_name,
                    supplierName: row.supplier_name || undefined
                });
            }

            if (row.qn_id && !questionnairesMap.has(row.qn_id)) {
                questionnairesMap.set(row.qn_id, {
                    id: row.qn_id,
                    name: row.qn_name,
                    supplierName: row.supplier_name || undefined
                });
            }

            if (row.supplier_id && !suppliersMap.has(row.supplier_id)) {
                suppliersMap.set(row.supplier_id, {
                    id: row.supplier_id,
                    name: row.supplier_name || "Unknown Supplier",
                    shortCode: row.supplier_code || undefined
                });
            }
        }

        const relationships = Array.from(relMap.values());

        return {
            totalQuestions: questionsMap.size,
            totalQuestionnaires: questionnairesMap.size,
            totalSuppliers: suppliersMap.size,
            relationships,
            questions: Array.from(questionsMap.values()),
            questionnaires: Array.from(questionnairesMap.values()),
            suppliers: Array.from(suppliersMap.values())
        };
    } catch (err) {
        console.error("Error fetching field usage details:", err);
        return { totalQuestions: 0, totalQuestionnaires: 0, totalSuppliers: 0, relationships: [], questions: [], questionnaires: [], suppliers: [] };
    }
}
