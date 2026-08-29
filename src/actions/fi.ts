"use server";

import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { enrichPartyReferences, enrichAddressReferences } from "@/actions/kyc-query";
import { getSourceDisplayName } from "@/lib/source-display";
import { getIdentity } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";
import { getActorContext } from "@/lib/auth/actor-context";
import { getRelationshipSummary, RelationshipSummary } from "@/services/relationshipService";

// Helper for Auth
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");

    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        select: { organizationId: true, clientLEId: true, fiEngagementId: true, role: true }
    });

    const user: UserWithMemberships = { id: identity.userId, memberships };
    const allowed = await can(user, action, context, prisma);
    
    if (!allowed) throw new Error(`Unauthorized: Cannot perform ${action}`);
    return { userId: identity.userId };
}


import { Prisma } from "@prisma/client"; // Added import

// 1. Get List of FIs
export async function getFIs() {
    const fis = await prisma.organization.findMany({
        where: { types: { has: "FI" } },
        orderBy: { name: 'asc' }
    });
    return fis;
}

// 2. Create an FI (Helper)
export async function createFI(name: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    const fi = await prisma.organization.create({
        data: {
            name,
            types: ["FI"],
            memberships: {
                create: {
                    userId,
                    role: "ORG_ADMIN"
                }
            }
        }
    });
    revalidatePath("/app/admin/mapper");
    return { success: true, data: fi };
}

// 3. Save Mapping as FISchema
export async function saveFIMapping(fiOrgId: string, mapping: any[]) {
    // 1. Get Active Master Schema
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true }
    });
    if (!activeSchema) return { success: false, error: "No active master schema" };

    // 2. Format as Overlay Definition
    // mapping is now [{ fiQuestion, masterFieldNo, masterQuestionGroupId }]
    const overlay = {
        mappings: mapping
    };

    // 3. Create or Update FISchema
    // We should probably upsert or create new version. For now, create new.
    await prisma.fISchema.create({
        data: {
            fiOrgId,
            masterSchemaId: activeSchema.id,
            overlayDefinition: overlay
        }
    });

    return { success: true };
}

// --- FI User Actions ---

const SUPPLIER_ORG_TYPES = ["FI", "SUPPLIER", "LAW_FIRM"] as const;

// Check if current user belongs to an FI / Supplier organization
export async function getFIOganization(fiOrgId?: string) {
    const identity = await getIdentity();
    const userId = identity?.userId;
    if (!userId) return null;

    if (fiOrgId) {
        const membership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: fiOrgId,
                organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }
            },
            include: { organization: true }
        });
        return membership?.organization || null;
    }

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get("compass_active_org")?.value;

    if (activeOrgId) {
        const activeMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: activeOrgId,
                organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }
            },
            include: { organization: true }
        });
        if (activeMembership) return activeMembership.organization;
    }

    const membership = await prisma.membership.findFirst({
        where: {
            userId: userId,
            organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }
        },
        include: { organization: true }
    });

    return membership?.organization || null;
}

export async function isFIUser() {
    const org = await getFIOganization();
    return !!org;
}

// Create a new Questionnaire (Draft)
// Create a new Questionnaire (Draft)
export async function uploadQuestionnaire(formData: FormData) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    let orgId = formData.get("fiOrgId") as string;

    if (!orgId) {
        // Try to default if user has only one FI
        const memberships = await prisma.membership.findMany({
            where: { userId, organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } } },
            select: { organizationId: true }
        });
        if (memberships.length === 1 && memberships[0].organizationId) {
            orgId = memberships[0].organizationId;
        } else {
            return { success: false, error: "Ambiguous context: Please specify Target FI Organization" };
        }
    }

    // Verify permission
    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: orgId, organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } } }
    });
    if (!membership) return { success: false, error: "Unauthorized for this Organization" };

    const name = formData.get("name") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
        return { success: false, error: "Missing name or file" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as any);

        const q = await prisma.questionnaire.create({
            data: {
                fiOrgId: orgId,
                name,
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
                status: "DRAFT"
            }
        });

        revalidatePath("/app/s/questionnaires");
        return { success: true, data: q };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to create questionnaire" };
    }
}

// Get Questionnaires for the current FI
export async function getFIQuestionnaires() {
    const org = await getFIOganization();
    if (!org) return [];

    return await prisma.questionnaire.findMany({
        where: {
            fiOrgId: org.id,
            isDeleted: false
        },
        orderBy: { updatedAt: 'desc' },
    });
}

// --- New Dashboard Actions ---

// 1. Get Dashboard Overview Stats
// 1. Get Dashboard Overview Stats
export async function getFIDashboardStats(fiOrgId?: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return null;
    const { userId } = identity;

    const userMemberships = await prisma.membership.findMany({
        where: { userId },
        select: { organizationId: true, fiEngagementId: true }
    });

    let targetFiOrgIds: string[] = [];

    if (fiOrgId) {
        const hasOrgAccess = userMemberships.some((m: any) => m.organizationId === fiOrgId);
        const userEngIds = userMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

        if (!hasOrgAccess && userEngIds.length === 0) {
            return null;
        }

        if (!hasOrgAccess) {
            const engInOrg = await prisma.fIEngagement.findFirst({
                where: { id: { in: userEngIds }, fiOrgId },
                select: { id: true }
            });
            if (!engInOrg) return null;
        }

        targetFiOrgIds = [fiOrgId];
    } else {
        const orgMemberships = await prisma.membership.findMany({
            where: {
                userId,
                organization: { types: { has: "FI" } },
                organizationId: { not: null }
            },
            select: { organizationId: true }
        });
        targetFiOrgIds = orgMemberships.map((m: any) => m.organizationId).filter(Boolean) as string[];

        const userEngIds = userMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];
        if (userEngIds.length > 0) {
            const engOrgs = await prisma.fIEngagement.findMany({
                where: { id: { in: userEngIds } },
                select: { fiOrgId: true }
            });
            const engOrgIds = engOrgs.map((e: any) => e.fiOrgId).filter(Boolean);
            targetFiOrgIds = Array.from(new Set([...targetFiOrgIds, ...engOrgIds]));
        }
    }

    if (targetFiOrgIds.length === 0) return null;

    const hasOrgAccessForTarget = userMemberships.some((m: any) => m.organizationId && targetFiOrgIds.includes(m.organizationId));
    const explicitEngagementIds = userMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    const [questionnaires, engagements, queries] = await Promise.all([
        prisma.questionnaire.count({
            where: {
                fiOrgId: { in: targetFiOrgIds },
                isDeleted: false,
                ...(!hasOrgAccessForTarget ? { fiEngagementId: { in: explicitEngagementIds } } : {})
            }
        }),
        prisma.fIEngagement.count({
            where: {
                fiOrgId: { in: targetFiOrgIds },
                isDeleted: false,
                status: { not: "ARCHIVED" },
                ...(!hasOrgAccessForTarget ? { id: { in: explicitEngagementIds } } : {})
            }
        }),
        prisma.query.count({
            where: {
                engagement: {
                    fiOrgId: { in: targetFiOrgIds },
                    ...(!hasOrgAccessForTarget ? { id: { in: explicitEngagementIds } } : {})
                },
                status: "OPEN"
            }
        })
    ]);

    return {
        questionnaires,
        engagements,
        queries
    };
}


// 2. Get Active Engagements with progress
// Define the return type explicitly to help IDEs
export type ApplicationEngagement = Prisma.FIEngagementGetPayload<{
    include: {
        clientLE: {
            include: { owners: { include: { party: true } } }
        },
        org: true,
        // We override questionnaires in the return, so we don't include it here to avoid conflict in partials?
        // Actually, let's just use the base payload and extend it.
    }
}> & {
    questionnaires: Prisma.QuestionnaireGetPayload<{
        select: { id: true, name: true, status: true, questions: true }
    }>[]
};

export async function getFIEngagements(fiOrgId?: string): Promise<ApplicationEngagement[]> {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    const memberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const myEngagementIds = memberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    if (myEngagementIds.length === 0) return [];

    const engagements = await prisma.fIEngagement.findMany({
        where: {
            id: { in: myEngagementIds },
            ...(fiOrgId ? { fiOrgId } : {}),
            isDeleted: false,
            status: { not: "ARCHIVED" },
            clientLE: { isDeleted: false }
        },
        include: {
            clientLE: {
                include: { owners: { where: { endAt: null }, include: { party: true } } }
            },
            org: true,
            questionnaireInstances: { // Fetch Instances instead of Templates
                where: { isDeleted: false },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    questions: true // We might need questions for progress calc
                }
            }
        },
        // orderBy: { updatedAt: 'desc' } // Removed as not in schema
    });

    // Map instances to 'questionnaires' property for frontend compatibility
    return engagements.map((e: any) => ({
        ...e,
        questionnaires: e.questionnaireInstances
    }));
}

// 2.b Get Questions for Dashboard (Kanban Items)
import { listAllMasterFields, listAllMasterGroups } from "@/services/masterData/definitionService";

export type SupplierAnswerVisibility = "NOT_SHARED" | "SHARED" | "RELEASED";

export interface SupplierVisibleDocument {
    id: string;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    uploadedAt: Date | string;
}

export interface SupplierVisibleProvenance {
    source: string | null;
    sourceType?: string | null;
    sourceReference?: string | null;
    timestamp: Date | string | null;
    lastValidatedAt?: Date | string | null;
    releaseProvenance?: any | null;
}

export interface SupplierQuestionView {
    id: string;
    supplierOrgId: string;
    relationshipId: string;
    clientLEId: string;
    clientLEName: string;
    clientOrganizationName: string | null;

    questionnaireId: string;
    questionnaireName: string;
    questionnaireVersion: string | null;

    sectionId: string | null;
    sectionName: string | null;
    questionNumber: string | null;
    order: number | null;

    questionText: string;
    guidance: string | null;
    isRequired: boolean | null;

    category: string;

    answerVisibility: SupplierAnswerVisibility;

    answer: any | null;
    provenance: SupplierVisibleProvenance | null;
    documents: SupplierVisibleDocument[];

    sharedAt: Date | string | null;
    releasedAt: Date | string | null;

    // Backwards compatibility for existing UI
    text: string;
    leName: string;

    // Optional metadata properties
    answerType?: string;
    appDataType?: string;
    isLocked?: boolean;
    sourceSectionId?: string | null;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    customFieldDefinitionId?: string | null;
    approvedMappingConfig?: any | null;
}

export interface FIWorkbenchData {
    questions: SupplierQuestionView[];
    les: string[];
    questionnaires: string[];
    categories: string[];
    counts: {
        total: number;
        notShared: number;
        shared: number;
        released: number;
    };
}

export async function getFIWorkbenchData(fiOrgId: string): Promise<FIWorkbenchData> {
    const emptyResult: FIWorkbenchData = {
        questions: [],
        les: [],
        questionnaires: [],
        categories: [],
        counts: { total: 0, notShared: 0, shared: 0, released: 0 }
    };

    const identity = await getIdentity();
    if (!identity?.userId) return emptyResult;
    const { userId } = identity;

    // 1. Verify access to Supplier Org or specific Relationships
    const orgMembership = await prisma.membership.findFirst({
        where: {
            userId,
            organizationId: fiOrgId,
            organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }
        }
    });

    const engagementMemberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const allowedEngagementIds = engagementMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    if (!orgMembership && allowedEngagementIds.length === 0) {
        return emptyResult;
    }

    const engagementFilter: any = {
        fiOrgId: fiOrgId,
        isDeleted: false,
        status: { not: "ARCHIVED" },
        clientLE: { isDeleted: false },
        ...(orgMembership ? {} : { id: { in: allowedEngagementIds } })
    };

    // 2. Fetch questions for direct engagement questionnaires AND linked Common Questionnaires for active relationships
    const questionsRaw = await prisma.question.findMany({
        where: {
            questionnaire: {
                isDeleted: false,
                OR: [
                    {
                        fiOrgId: fiOrgId,
                        fiEngagementId: { not: null },
                        fiEngagement: engagementFilter
                    },
                    {
                        kind: "COMMON_QUESTIONNAIRE",
                        commonForClients: {
                            some: {
                                isDeleted: false,
                                fiEngagements: { some: engagementFilter }
                            }
                        }
                    }
                ]
            }
        },
        include: {
            documents: {
                select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    sizeBytes: true,
                    createdAt: true
                }
            },
            questionnaire: {
                include: {
                    commonForClients: {
                        include: {
                            fiEngagements: {
                                where: engagementFilter,
                                include: {
                                    clientLE: {
                                        include: {
                                            owners: {
                                                where: { endAt: null },
                                                include: { party: { select: { name: true } } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    fiEngagement: {
                        include: {
                            clientLE: {
                                include: {
                                    owners: {
                                        where: { endAt: null },
                                        include: { party: { select: { name: true } } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { order: 'asc' }
    });

    // 3. Fetch latest QuestionnaireSubmission per relationship
    const uniqueEngagementIds = (questionsRaw
        .map((q: any) => q.questionnaire?.fiEngagement?.id)
        .filter(Boolean) as string[])
        .concat(
            questionsRaw.flatMap((q: any) =>
                (q.questionnaire?.commonForClients || []).flatMap((c: any) =>
                    (c.fiEngagements || []).map((e: any) => e.id)
                )
            )
        );
    const uniqueEngagementIdsSet = Array.from(new Set(uniqueEngagementIds));

    const latestSubmissions = uniqueEngagementIdsSet.length > 0
        ? await prisma.questionnaireSubmission.findMany({
            where: { relationshipId: { in: uniqueEngagementIdsSet } },
            orderBy: [
                { relationshipId: 'asc' },
                { questionnaireId: 'asc' },
                { submittedAt: 'desc' }
            ],
            include: {
                answers: {
                    include: {
                        attachments: { include: { document: true } }
                    }
                }
            }
        })
        : [];

    const submissionAnswerMap = new Map<string, any>();
    const submissionMetadataMap = new Map<string, { submittedAt: Date; versionNumber: number; submissionNumber: number }>();

    for (const sub of latestSubmissions) {
        const keyPrefix = `${sub.questionnaireId}:${sub.relationshipId}`;
        if (!submissionMetadataMap.has(keyPrefix)) {
            submissionMetadataMap.set(keyPrefix, {
                submittedAt: sub.submittedAt,
                versionNumber: sub.versionNumber,
                submissionNumber: sub.submissionNumber
            });
            for (const ans of sub.answers) {
                const answerKey = `${keyPrefix}:${ans.sourceQuestionId}`;
                submissionAnswerMap.set(answerKey, ans);
            }
        }
    }

    const [allFields, allGroups] = await Promise.all([
        listAllMasterFields(),
        listAllMasterGroups()
    ]);

    const fieldDefMap = new Map(allFields.map((f: any) => [f.fieldNo, f]));
    const fieldCategoryMap = new Map(allFields.map((f: any) => [f.fieldNo, f.category]));
    const groupCategoryMap = new Map(allGroups.map((g: any) => [g.key, g.category]));

    // 4. Transform & Strictly Redact Server-Side
    const transformedQuestionsNested = await Promise.all(questionsRaw.map(async (q: any) => {
        const isCommon = q.questionnaire?.kind === "COMMON_QUESTIONNAIRE";
        let contexts: Array<{ engagement: any; clientLE: any }> = [];

        if (isCommon) {
            for (const clientLE of (q.questionnaire.commonForClients || [])) {
                for (const eng of (clientLE.fiEngagements || [])) {
                    contexts.push({ engagement: eng, clientLE: eng.clientLE || clientLE });
                }
            }
        } else {
            const engagement = q.questionnaire?.fiEngagement;
            const clientLE = engagement?.clientLE;
            if (engagement && clientLE) {
                contexts = [{ engagement, clientLE }];
            }
        }

        const items: SupplierQuestionView[] = [];

        for (const ctx of contexts) {
            const { engagement, clientLE } = ctx;
            const clientOrgName = clientLE?.owners?.[0]?.party?.name || null;
            const fieldDef = q.masterFieldNo ? fieldDefMap.get(q.masterFieldNo) : undefined;

            let category = "Uncategorized";
            if (q.masterFieldNo) category = fieldCategoryMap.get(q.masterFieldNo) || "Uncategorized";
            else if (q.masterQuestionGroupId) category = groupCategoryMap.get(q.masterQuestionGroupId) || "Uncategorized";
            else if (q.customFieldDefinitionId) category = "Custom";

            let answerVisibility: SupplierAnswerVisibility = "NOT_SHARED";
            let answer: any | null = null;
            let provenance: SupplierVisibleProvenance | null = null;
            let documents: SupplierVisibleDocument[] = [];
            let sharedAt: Date | string | null = null;
            let releasedAt: Date | string | null = null;

            const engagementId = engagement?.id || "";
            const keyPrefix = `${q.questionnaireId}:${engagementId}`;
            const subMetadata = submissionMetadataMap.get(keyPrefix);
            const subAnswer = engagementId ? submissionAnswerMap.get(`${keyPrefix}:${q.id}`) : null;

            if (subAnswer) {
                answerVisibility = "RELEASED";
                answer = subAnswer.explicitNone ? { explicitNone: true } : (subAnswer.valueJson ?? null);
                releasedAt = subMetadata?.submittedAt || q.releasedAt || null;
                
                const subProv = subAnswer.provenanceJson || {};
                const subSourceType = subProv.sourceType || "USER_INPUT";
                const subSourceRef = subProv.sourceReference || null;
                const isSubUserInput = subSourceType === "USER_INPUT";

                const lastValidatedAt = isSubUserInput
                    ? (subMetadata?.submittedAt || q.releasedAt || null)
                    : (subProv.lastValidatedAt || subProv.sourceCheckedAt || subProv.assertedAt || null);

                provenance = {
                    source: subProv.sourceLabel || getSourceDisplayName(subSourceType, subSourceRef) || "Formal Submission",
                    sourceType: subSourceType,
                    sourceReference: subSourceRef,
                    timestamp: subMetadata?.submittedAt || q.releasedAt || null,
                    lastValidatedAt,
                    releaseProvenance: subProv
                };
                documents = (subAnswer.attachments || []).map((att: any) => ({
                    id: att.document.id,
                    fileName: att.document.name,
                    fileType: att.document.mimeType || null,
                    fileSize: att.document.sizeBytes ? Number(att.document.sizeBytes) : null,
                    uploadedAt: att.document.createdAt
                }));
            } else if (q.status === "RELEASED") {
                answerVisibility = "RELEASED";
                sharedAt = q.sharedAt ?? null;
                releasedAt = q.releasedAt ?? null;
                let derivedVal: any = null;

                if (q.answer !== null && q.answer !== undefined) {
                    answer = q.answer;
                } else if (q.masterFieldNo && clientLE) {
                    const subjectLeId = clientLE.legalEntityId || null;
                    const ownerScopeId = (await KycStateService.resolveScopeId(clientLE.id)) || undefined;
                    const snapshotDate = q.releasedAt ? new Date(q.releasedAt) : undefined;

                    try {
                        const isMulti = fieldDef?.isMultiValue || false;
                        if (isMulti) {
                            const collection = await KycStateService.getAuthoritativeCollection(
                                { subjectLeId, clientLEId: clientLE.id },
                                q.masterFieldNo,
                                ownerScopeId,
                                snapshotDate
                            );
                            if (collection.length > 0) {
                                derivedVal = {
                                    value: collection.map((c: any) => c.value),
                                    sourceType: collection[0].sourceType,
                                    sourceReference: collection[0].sourceReference,
                                    assertedAt: collection[0].assertedAt,
                                    sourceCheckedAt: collection[0].sourceCheckedAt
                                };
                            }
                        } else {
                            derivedVal = await KycStateService.getAuthoritativeValue(
                                { subjectLeId, clientLEId: clientLE.id },
                                q.masterFieldNo,
                                ownerScopeId,
                                snapshotDate
                            );
                        }

                        if (derivedVal) {
                            if (derivedVal.value && typeof derivedVal.value === 'object' && derivedVal.value.explicitNone) {
                                answer = { explicitNone: true };
                            } else {
                                const vals = Array.isArray(derivedVal.value) ? derivedVal.value : [derivedVal.value];
                                await enrichPartyReferences(vals);
                                await enrichAddressReferences(vals);
                                answer = derivedVal.value;
                            }
                        }
                    } catch (err) {
                        console.error(`[fi.ts] Legacy RELEASED fallback resolution failed for question ${q.id}:`, err);
                    }
                }

                const relProv = q.releaseProvenance || {};
                const relSourceType = derivedVal?.sourceType || relProv.sourceType || "USER_INPUT";
                const relSourceRef = derivedVal?.sourceReference || relProv.sourceReference || null;
                const relSourceLabel = q.releaseProvenance?.provenanceDisplay?.source || q.releaseProvenance?.sourceLabel || getSourceDisplayName(relSourceType, relSourceRef);
                const isRelUserInput = relSourceType === "USER_INPUT";

                const lastValidatedAt = isRelUserInput
                    ? (q.releasedAt || null)
                    : (derivedVal?.sourceCheckedAt || derivedVal?.assertedAt || relProv.lastValidatedAt || relProv.sourceCheckedAt || null);

                provenance = {
                    source: relSourceLabel || "Formal Release",
                    sourceType: relSourceType,
                    sourceReference: relSourceRef,
                    timestamp: q.releasedAt || null,
                    lastValidatedAt,
                    releaseProvenance: relProv
                };
                documents = (q.documents || []).map((d: any) => ({
                    id: d.id,
                    fileName: d.name,
                    fileType: d.mimeType || null,
                    fileSize: d.sizeBytes ? Number(d.sizeBytes) : null,
                    uploadedAt: d.createdAt
                }));
            } else if (q.status === "SHARED") {
                answerVisibility = "SHARED";
                sharedAt = q.sharedAt ?? null;
                let derivedVal: any = null;

                if (q.answer !== null && q.answer !== undefined) {
                    answer = q.answer;
                } else if (q.masterFieldNo && clientLE) {
                    const subjectLeId = clientLE.legalEntityId || null;
                    const ownerScopeId = (await KycStateService.resolveScopeId(clientLE.id)) || undefined;

                    try {
                        const isMulti = fieldDef?.isMultiValue || false;
                        if (isMulti) {
                            const collection = await KycStateService.getAuthoritativeCollection(
                                { subjectLeId, clientLEId: clientLE.id },
                                q.masterFieldNo,
                                ownerScopeId,
                                undefined
                            );
                            if (collection.length > 0) {
                                derivedVal = {
                                    value: collection.map((c: any) => c.value),
                                    sourceType: collection[0].sourceType,
                                    sourceReference: collection[0].sourceReference,
                                    assertedAt: collection[0].assertedAt,
                                    sourceCheckedAt: collection[0].sourceCheckedAt
                                };
                            }
                        } else {
                            derivedVal = await KycStateService.getAuthoritativeValue(
                                { subjectLeId, clientLEId: clientLE.id },
                                q.masterFieldNo,
                                ownerScopeId,
                                undefined
                            );
                        }

                        if (derivedVal) {
                            if (derivedVal.value && typeof derivedVal.value === 'object' && derivedVal.value.explicitNone) {
                                answer = { explicitNone: true };
                            } else {
                                const vals = Array.isArray(derivedVal.value) ? derivedVal.value : [derivedVal.value];
                                await enrichPartyReferences(vals);
                                await enrichAddressReferences(vals);
                                answer = derivedVal.value;
                            }
                        }
                    } catch (err) {
                        console.error(`[fi.ts] SHARED live resolution failed for question ${q.id}:`, err);
                    }
                } else if (q.masterQuestionGroupId && clientLE) {
                    const subjectLeId = clientLE.legalEntityId || null;
                    const ownerScopeId = (await KycStateService.resolveScopeId(clientLE.id)) || undefined;

                    try {
                        const group = await prisma.masterFieldGroup.findFirst({
                            where: { key: q.masterQuestionGroupId, isActive: true },
                            include: {
                                items: {
                                    where: { field: { isActive: true } },
                                    include: { field: true },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        });

                        if (group && group.items.length > 0) {
                            const groupValues: Record<number, any> = {};
                            let primaryChildSource: any = null;

                            for (const item of group.items) {
                                const childDef = item.field;
                                let childVal: any = null;
                                if (childDef.isMultiValue) {
                                    const collection = await KycStateService.getAuthoritativeCollection(
                                        { subjectLeId, clientLEId: clientLE.id },
                                        item.fieldNo,
                                        ownerScopeId,
                                        undefined
                                    );
                                    if (collection.length > 0) {
                                        childVal = {
                                            value: collection.map((c: any) => c.value),
                                            sourceType: collection[0].sourceType,
                                            sourceReference: collection[0].sourceReference,
                                            assertedAt: collection[0].assertedAt,
                                            sourceCheckedAt: collection[0].sourceCheckedAt
                                        };
                                    }
                                } else {
                                    childVal = await KycStateService.getAuthoritativeValue(
                                        { subjectLeId, clientLEId: clientLE.id },
                                        item.fieldNo,
                                        ownerScopeId,
                                        undefined
                                    );
                                }

                                if (childVal && childVal.value !== null && childVal.value !== undefined && childVal.value !== '') {
                                    const vals = Array.isArray(childVal.value) ? childVal.value : [childVal.value];
                                    await enrichPartyReferences(vals);
                                    await enrichAddressReferences(vals);
                                    groupValues[item.fieldNo] = childVal.value;
                                    if (!primaryChildSource) {
                                        primaryChildSource = childVal;
                                    }
                                }
                            }

                            if (Object.keys(groupValues).length > 0) {
                                answer = groupValues;
                                derivedVal = primaryChildSource || {
                                    sourceType: 'USER_INPUT',
                                    sourceReference: null,
                                    assertedAt: new Date()
                                };
                            }
                        }
                    } catch (err) {
                        console.error(`[fi.ts] SHARED group live resolution failed for question ${q.id}:`, err);
                    }
                }

                const sharedSourceType = derivedVal?.sourceType || "USER_INPUT";
                const sharedSourceRef = derivedVal?.sourceReference || null;
                const sharedSourceLabel = derivedVal ? getSourceDisplayName(sharedSourceType, sharedSourceRef) : "Provisional Shared";
                const sharedTimestamp = q.sharedAt || derivedVal?.assertedAt || null;
                const lastValidatedAt = derivedVal?.sourceCheckedAt || derivedVal?.assertedAt || q.sharedAt || null;

                provenance = {
                    source: sharedSourceLabel || "Provisional Shared",
                    sourceType: sharedSourceType,
                    sourceReference: sharedSourceRef,
                    timestamp: sharedTimestamp,
                    lastValidatedAt,
                    releaseProvenance: null
                };
                documents = (q.documents || []).map((d: any) => ({
                    id: d.id,
                    fileName: d.name,
                    fileType: d.mimeType || null,
                    fileSize: d.sizeBytes ? Number(d.sizeBytes) : null,
                    uploadedAt: d.createdAt
                }));
            } else {
                answerVisibility = "NOT_SHARED";
            }

            items.push({
                id: q.id,
                supplierOrgId: fiOrgId,
                relationshipId: engagement?.id || "",
                clientLEId: clientLE?.id || "",
                clientLEName: clientLE?.name || "Unknown",
                clientOrganizationName: clientOrgName,

                questionnaireId: q.questionnaire.id,
                questionnaireName: q.questionnaire.name,
                questionnaireVersion: (q.questionnaire as any).referenceCode || null,

                sectionId: q.sourceSectionId || null,
                sectionName: null,
                questionNumber: q.masterFieldNo ? String(q.masterFieldNo) : null,
                order: q.order ?? null,

                questionText: q.text,
                guidance: null,
                isRequired: null,

                category,

                answerVisibility,
                answer,
                provenance,
                documents,

                sharedAt,
                releasedAt,

                text: q.text,
                leName: clientLE?.name || "Unknown",
                answerType: q.expectedDataType || "TEXT",
                appDataType: fieldDef?.appDataType || q.expectedDataType || undefined,
                isLocked: q.isLocked ?? false,
                sourceSectionId: q.sourceSectionId || null,

                masterFieldNo: q.masterFieldNo ?? null,
                masterQuestionGroupId: q.masterQuestionGroupId ?? null,
                customFieldDefinitionId: q.customFieldDefinitionId ?? null,
                approvedMappingConfig: q.approvedMappingConfig ?? null
            });
        }

        return items;
    }));

    const questions: SupplierQuestionView[] = transformedQuestionsNested.flat();

    // Query all active engagements to ensure every relationship appears in LE filters
    const activeEngagements = await prisma.fIEngagement.findMany({
        where: engagementFilter,
        select: {
            clientLE: { select: { name: true } }
        }
    });
    const allActiveLENames = activeEngagements.map((e: any) => e.clientLE?.name).filter(Boolean) as string[];
    const combinedLEs = Array.from(new Set([...allActiveLENames, ...questions.map((q) => q.clientLEName)])).sort();

    const notSharedCount = questions.filter(q => q.answerVisibility === "NOT_SHARED").length;
    const sharedCount = questions.filter(q => q.answerVisibility === "SHARED").length;
    const releasedCount = questions.filter(q => q.answerVisibility === "RELEASED").length;

    const parsedQuestions = JSON.parse(JSON.stringify(questions));

    return {
        questions: parsedQuestions,
        les: combinedLEs,
        questionnaires: Array.from(new Set(questions.map((q) => q.questionnaireName))).sort(),
        categories: Array.from(new Set(questions.map((q) => q.category))).sort(),
        counts: {
            total: questions.length,
            notShared: notSharedCount,
            shared: sharedCount,
            released: releasedCount
        }
    };
}

export interface SupplierTeamMemberAccessScope {
    kind: "SUPPLIER" | "RELATIONSHIPS";
    relationships?: {
        id: string;
        clientLEName: string;
    }[];
}

export interface SupplierTeamMemberSummary {
    userId: string;
    name: string | null;
    email: string;
    role: string;
    roleLabel: string;
    accessScope: SupplierTeamMemberAccessScope;
    joinedAt: Date | string | null;
}

export interface SupplierPendingInvitationSummary {
    id: string;
    email: string;
    role: string;
    roleLabel: string;
    accessScope: string;
    invitedAt: Date | string;
    expiresAt: Date | string | null;
}

export interface SupplierTeamSummary {
    members: SupplierTeamMemberSummary[];
    pendingInvitations: SupplierPendingInvitationSummary[];
}

function formatSupplierRoleLabel(role: string): string {
    switch (role) {
        case "ORG_ADMIN":
            return "Supplier Admin";
        case "ORG_MEMBER":
            return "Supplier Member";
        case "RELATIONSHIP_ADMIN":
            return "Relationship Admin";
        case "RELATIONSHIP_USER":
            return "Relationship User";
        default:
            return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
}

export async function getSupplierTeamMembers(fiOrgId: string): Promise<SupplierTeamSummary> {
    const identity = await getIdentity();
    if (!identity?.userId) return { members: [], pendingInvitations: [] };
    const { userId } = identity;

    // Check user permissions / tenant membership for fiOrgId
    const userMemberships = await prisma.membership.findMany({
        where: { userId },
        include: { fiEngagement: { select: { fiOrgId: true } } }
    });

    type UserMemRec = typeof userMemberships[number];
    const isSupplierMember = userMemberships.some(
        (m: UserMemRec) => m.organizationId === fiOrgId || m.fiEngagement?.fiOrgId === fiOrgId
    );

    if (!isSupplierMember) {
        return { members: [], pendingInvitations: [] };
    }

    // Fetch active memberships for this Supplier organization
    const rawMemberships = await prisma.membership.findMany({
        where: {
            OR: [
                { organizationId: fiOrgId },
                { fiEngagement: { fiOrgId, isDeleted: false } }
            ]
        },
        include: {
            user: {
                select: { id: true, name: true, email: true }
            },
            fiEngagement: {
                select: {
                    id: true,
                    clientLE: { select: { name: true } }
                }
            }
        },
        orderBy: { createdAt: "asc" }
    });

    // Group memberships by user
    const memberMap = new Map<string, SupplierTeamMemberSummary>();

    rawMemberships.forEach((m: any) => {
        if (!m.user) return;
        const uId = m.user.id;
        const existing = memberMap.get(uId);

        const isSupplierWide = m.organizationId === fiOrgId;
        const roleLabel = formatSupplierRoleLabel(m.role);

        if (!existing) {
            const accessScope: SupplierTeamMemberAccessScope = isSupplierWide
                ? { kind: "SUPPLIER" }
                : {
                      kind: "RELATIONSHIPS",
                      relationships: m.fiEngagement
                          ? [{ id: m.fiEngagement.id, clientLEName: m.fiEngagement.clientLE?.name || "Unknown ClientLE" }]
                          : []
                  };

            memberMap.set(uId, {
                userId: uId,
                name: m.user.name || null,
                email: m.user.email || "No Email",
                role: m.role,
                roleLabel,
                accessScope,
                joinedAt: m.createdAt ? m.createdAt.toISOString() : null
            });
        } else {
            // Upgrade access scope to SUPPLIER if supplier-wide membership exists
            if (isSupplierWide) {
                existing.accessScope = { kind: "SUPPLIER" };
                if (m.role === "ORG_ADMIN") {
                    existing.role = m.role;
                    existing.roleLabel = roleLabel;
                }
            } else if (existing.accessScope.kind === "RELATIONSHIPS" && m.fiEngagement) {
                const rels = existing.accessScope.relationships || [];
                if (!rels.some((r) => r.id === m.fiEngagement.id)) {
                    rels.push({
                        id: m.fiEngagement.id,
                        clientLEName: m.fiEngagement.clientLE?.name || "Unknown ClientLE"
                    });
                }
            }
        }
    });

    // Fetch pending invitations for this Supplier organization or its Relationships
    const pendingInvites = await prisma.invitation.findMany({
        where: {
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            OR: [
                { organizationId: fiOrgId },
                { fiEngagement: { fiOrgId, isDeleted: false } }
            ]
        },
        include: {
            fiEngagement: {
                select: { clientLE: { select: { name: true } } }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    const pendingSummaries: SupplierPendingInvitationSummary[] = pendingInvites.map((inv: any) => {
        const isOrgWide = inv.organizationId === fiOrgId;
        const scopeStr = isOrgWide
            ? "All Relationships"
            : inv.fiEngagement?.clientLE?.name
            ? inv.fiEngagement.clientLE.name
            : "Relationship Access";

        return {
            id: inv.id,
            email: inv.sentToEmail,
            role: inv.role,
            roleLabel: formatSupplierRoleLabel(inv.role),
            accessScope: scopeStr,
            invitedAt: inv.createdAt ? inv.createdAt.toISOString() : new Date().toISOString(),
            expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null
        };
    });

    return {
        members: Array.from(memberMap.values()),
        pendingInvitations: pendingSummaries
    };
}

export async function getFITeamMembers(fiOrgId: string) {
    const summary = await getSupplierTeamMembers(fiOrgId);
    return summary.members.map((m) => ({
        id: m.userId,
        name: m.name || "Unknown User",
        email: m.email,
        role: m.role,
        image: null
    }));
}

export async function getFIDashboardQuestions(filters?: { clientLEId?: string; questionnaireName?: string; fiOrgId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    let targetFiOrgIds: string[] = [];

    if (filters?.fiOrgId) {
        const membership = await prisma.membership.findFirst({
            where: { userId, organizationId: filters.fiOrgId, organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } } }
        });
        if (!membership) return [];
        targetFiOrgIds = [filters.fiOrgId];
    } else {
        const memberships = await prisma.membership.findMany({
            where: { userId, organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }, organizationId: { not: null } },
            select: { organizationId: true }
        });
        targetFiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    }

    if (targetFiOrgIds.length === 0) return [];

    const explicitMemberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const explicitEngagementIds = explicitMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    const where: any = {
        questionnaire: {
            fiOrgId: { in: targetFiOrgIds },
            fiEngagement: {
                id: { in: explicitEngagementIds },
                ...(filters?.clientLEId ? { clientLEId: filters.clientLEId } : {})
            },
            name: filters?.questionnaireName ? {
                contains: filters.questionnaireName,
                mode: 'insensitive'
            } : undefined
        }
    };

    if (!where.questionnaire.name) delete where.questionnaire.name;

    return await prisma.question.findMany({
        where,
        include: {
            questionnaire: {
                include: {
                    fiEngagement: {
                        include: { clientLE: true }
                    }
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });
}

// 3. Get Query Inbox
export async function getFIQueries() {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    const memberships = await prisma.membership.findMany({
        where: { userId, organization: { types: { hasSome: [...SUPPLIER_ORG_TYPES] } }, organizationId: { not: null } },
        select: { organizationId: true }
    });
    const fiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    if (fiOrgIds.length === 0) return [];

    const explicitMemberships = await prisma.membership.findMany({
        where: { userId, fiEngagementId: { not: null } },
        select: { fiEngagementId: true }
    });
    const explicitEngagementIds = explicitMemberships.map((m: any) => m.fiEngagementId).filter(Boolean) as string[];

    return await prisma.query.findMany({
        where: {
            engagement: {
                id: { in: explicitEngagementIds },
                fiOrgId: { in: fiOrgIds }
            },
            status: "OPEN"
        },
        include: {
            engagement: {
                include: { clientLE: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}
// 4. Get Single Engagement by ID
export async function getFIEngagementById(id: string): Promise<ApplicationEngagement | null> {
    try {
        await ensureAuthorization(Action.ENG_VIEW_RELEASED_DATA, { engagementId: id });
    } catch (e) {
        return null;
    }

    const whereClause: any = { id };
    const engagement = await prisma.fIEngagement.findFirst({
        where: whereClause,
        include: {
            clientLE: {
                include: { owners: { where: { endAt: null }, include: { party: true } } }
            },
            org: true,
            questionnaireInstances: {
                where: { isDeleted: false },
                include: {
                    questions: {
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    });

    if (!engagement) return null;

    return {
        ...engagement,
        questionnaires: engagement.questionnaireInstances
    };
}

export async function getRelationshipSummaryAction(relationshipId: string): Promise<{ success: boolean; data?: RelationshipSummary; error?: string }> {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const actor = await getActorContext(identity.userId, "WEB");
        const summary = await getRelationshipSummary(actor, relationshipId);
        return { success: true, data: summary };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to retrieve relationship summary" };
    }
}

// 5. Assign Questionnaire to Engagement (Deep Clone / Snapshot)
// 5. Assign Questionnaire to Engagement (Deep Clone / Snapshot)
export async function assignQuestionnaireToEngagement(engagementId: string, templateId: string) {
    try {
        await ensureAuthorization(Action.ENG_UPDATE, { engagementId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: { fiOrgId: true }
    });
    if (!engagement) return { success: false, error: "Engagement not found" };

    // 1. Fetch Template and its Questions (Ensure template belongs to SAME Org)
    const template = await prisma.questionnaire.findUnique({
        where: { id: templateId, fiOrgId: engagement.fiOrgId },
        include: { questions: true }
    });

    if (!template) return { success: false, error: "Template not found or mismatch" };

    // VISIBILITY GUARD — if the template is a V2 Reference Snapshot, the engagement
    // org must be able to discover it. Prevents guessed PRIVATE IDs from being cloned.
    // Non-REFERENCE_SNAPSHOT rows (legacy uploads, engagement questionnaires) bypass.
    if (template.kind === "REFERENCE_SNAPSHOT") {
        const { canOrgDiscoverReferenceSnapshot } = await import("@/actions/questionnaires-v2");
        const canDiscover = await canOrgDiscoverReferenceSnapshot(engagement.fiOrgId, templateId);
        if (!canDiscover) {
            return { success: false, error: "Unauthorized: this Reference Snapshot is not visible to your organisation" };
        }
    }

    try {
        // 2. Create Instance (Copy of Questionnaire) linked to Engagement
        const instance = await prisma.questionnaire.create({
            data: {
                fiOrgId: engagement.fiOrgId,
                name: template.name, // Can append (Copy) if desired, but ideally kept same name for UI
                status: "SHARED",
                fileName: template.fileName,
                fileType: template.fileType,
                fileContent: template.fileContent,
                mappings: template.mappings ?? undefined, // Handle null vs undefined for Prisma
                extractedContent: template.extractedContent ?? undefined,
                rawText: template.rawText,
                fiEngagementId: engagementId, // The Link!
                // Copy Privacy settings if needed
                ownerOrgId: template.ownerOrgId,

                // 3. Deep Clone Questions (Snapshot)
                questions: {
                    create: template.questions.map((q: any) => ({
                        text: q.text,
                        compactText: q.compactText,
                        order: q.order,
                        status: "DRAFT",
                        sourceSectionId: q.sourceSectionId,
                        masterFieldNo: q.masterFieldNo,
                        masterQuestionGroupId: q.masterQuestionGroupId,
                        customFieldDefinitionId: q.customFieldDefinitionId,
                        // Note: We do NOT copy 'answer' or 'activities' or 'comments' as this is a fresh start
                    }))
                }
            }
        });

        revalidatePath(`/app/s/engagements/${engagementId}`);
        return { success: true, data: instance };

    } catch (e: any) {
        console.error("Failed to assign questionnaire:", e);
        return { success: false, error: "Database error" };
    }
}

// 6. Archive / Delete Engagement
// 6. Archive / Delete Engagement
// 6. Delete Engagement
export async function deleteEngagement(id: string) {
    try {
        await ensureAuthorization(Action.ENG_DELETE, { engagementId: id });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Cascade: Delete linked Questionnaire Instances
        await prisma.questionnaire.updateMany({
            where: { fiEngagementId: id },
            data: { isDeleted: true }
        });

        await prisma.fIEngagement.update({
            where: { id }, // Already guarded by check above
            data: { isDeleted: true }
        });
        revalidatePath("/app/s");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete engagement" };
    }
}

export async function archiveEngagement(id: string) {
    try {
        await ensureAuthorization(Action.ENG_UPDATE, { engagementId: id });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await prisma.fIEngagement.update({
            where: { id },
            data: { status: "ARCHIVED" }
        });
        revalidatePath("/app/s");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to archive engagement" };
    }
}

// 7. Supplier Relationships Expandable Summary Action & DTOs
export interface SupplierRelationshipQuestionnaireSummary {
    id: string;
    questionnaireId: string;
    name: string;
    version: string | null;
    referenceCode: string | null;
    questionCounts: {
        total: number;
        notShared: number;
        shared: number;
        released: number;
    };
    latestSharedOrReleasedAt: Date | string | null;
}

export interface SupplierRelationshipQuestionnaireSummary {
    id: string;
    questionnaireId: string;
    name: string;
    version: string | null;
    referenceCode: string | null;
    questionCounts: {
        total: number;
        notShared: number;
        shared: number;
        released: number;
    };
    latestSharedOrReleasedAt: Date | string | null;
}

export interface SupplierClientLERelationshipSummary {
    relationshipId: string;
    clientLEId: string;
    clientLEName: string;
    status: string | null;
    questionCounts: {
        total: number;
        notShared: number;
        shared: number;
        released: number;
    };
    questionnaires: SupplierRelationshipQuestionnaireSummary[];
}

export interface SupplierClientRelationshipGroup {
    clientOrganizationId: string;
    clientOrganizationName: string;
    questionCounts: {
        total: number;
        notShared: number;
        shared: number;
        released: number;
    };
    questionnaireCount: number;
    legalEntities: SupplierClientLERelationshipSummary[];
}

export async function getSupplierRelationshipsSummary(fiOrgId: string): Promise<SupplierClientRelationshipGroup[]> {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { organizationId: true, fiEngagementId: true }
    });

    type MembershipRec = typeof memberships[number];
    const hasOrgAccess = memberships.some((m: MembershipRec) => m.organizationId === fiOrgId);
    const userEngagementIds = memberships.map((m: MembershipRec) => m.fiEngagementId).filter(Boolean) as string[];

    if (!hasOrgAccess && userEngagementIds.length === 0) {
        return [];
    }

    const engagements = await prisma.fIEngagement.findMany({
        where: {
            fiOrgId,
            isDeleted: false,
            clientLE: { isDeleted: false },
            ...(!hasOrgAccess ? { id: { in: userEngagementIds } } : {})
        },
        include: {
            clientLE: {
                include: {
                    owners: {
                        where: { endAt: null },
                        include: { party: true }
                    }
                }
            },
            questionnaireInstances: {
                where: { isDeleted: false },
                include: {
                    questions: {
                        select: {
                            id: true,
                            status: true,
                            sharedAt: true,
                            releasedAt: true
                        }
                    }
                }
            }
        },
        orderBy: { clientLE: { name: "asc" } }
    });

    const clientGroupMap = new Map<string, {
        clientOrganizationId: string;
        clientOrganizationName: string;
        legalEntities: SupplierClientLERelationshipSummary[];
    }>();

    engagements.forEach((eng: any) => {
        const ownerParty = eng.clientLE?.owners?.[0]?.party;
        const clientOrgId = ownerParty?.id || `unassigned-${eng.clientLEId}`;
        const clientOrgName = ownerParty?.name || eng.clientLE?.name || "Independent Client Legal Entities";

        let engTotal = 0;
        let engNotShared = 0;
        let engShared = 0;
        let engReleased = 0;

        const qSummaries: SupplierRelationshipQuestionnaireSummary[] = (eng.questionnaireInstances || []).map((q: any) => {
            let qTotal = 0;
            let qNotShared = 0;
            let qShared = 0;
            let qReleased = 0;
            let latestTimestamp: Date | null = null;

            (q.questions || []).forEach((quest: any) => {
                qTotal++;
                if (quest.status === "SHARED") {
                    qShared++;
                    const dt = quest.sharedAt ? new Date(quest.sharedAt) : null;
                    if (dt && (!latestTimestamp || dt > latestTimestamp)) {
                        latestTimestamp = dt;
                    }
                } else if (quest.status === "RELEASED") {
                    qReleased++;
                    const dt = quest.releasedAt ? new Date(quest.releasedAt) : null;
                    if (dt && (!latestTimestamp || dt > latestTimestamp)) {
                        latestTimestamp = dt;
                    }
                } else {
                    qNotShared++;
                }
            });

            engTotal += qTotal;
            engNotShared += qNotShared;
            engShared += qShared;
            engReleased += qReleased;

            const latestIso: string | null = latestTimestamp ? (latestTimestamp as Date).toISOString() : null;

            return {
                id: q.id,
                questionnaireId: q.id,
                name: q.name,
                version: q.version || null,
                referenceCode: q.code || q.referenceCode || null,
                questionCounts: {
                    total: qTotal,
                    notShared: qNotShared,
                    shared: qShared,
                    released: qReleased
                },
                latestSharedOrReleasedAt: latestIso
            };
        });

        const leSummary: SupplierClientLERelationshipSummary = {
            relationshipId: eng.id,
            clientLEId: eng.clientLEId,
            clientLEName: eng.clientLE?.name || "Unknown ClientLE",
            status: eng.status || "Active",
            questionCounts: {
                total: engTotal,
                notShared: engNotShared,
                shared: engShared,
                released: engReleased
            },
            questionnaires: qSummaries
        };

        if (!clientGroupMap.has(clientOrgId)) {
            clientGroupMap.set(clientOrgId, {
                clientOrganizationId: clientOrgId,
                clientOrganizationName: clientOrgName,
                legalEntities: []
            });
        }
        clientGroupMap.get(clientOrgId)!.legalEntities.push(leSummary);
    });

    const groups: SupplierClientRelationshipGroup[] = Array.from(clientGroupMap.values()).map((grp) => {
        let grpTotal = 0;
        let grpNotShared = 0;
        let grpShared = 0;
        let grpReleased = 0;
        let grpQuestionnaireCount = 0;

        grp.legalEntities.forEach((le) => {
            grpTotal += le.questionCounts.total;
            grpNotShared += le.questionCounts.notShared;
            grpShared += le.questionCounts.shared;
            grpReleased += le.questionCounts.released;
            grpQuestionnaireCount += le.questionnaires.length;
        });

        grp.legalEntities.sort((a, b) => a.clientLEName.localeCompare(b.clientLEName));

        return {
            clientOrganizationId: grp.clientOrganizationId,
            clientOrganizationName: grp.clientOrganizationName,
            questionCounts: {
                total: grpTotal,
                notShared: grpNotShared,
                shared: grpShared,
                released: grpReleased
            },
            questionnaireCount: grpQuestionnaireCount,
            legalEntities: grp.legalEntities
        };
    });

    groups.sort((a, b) => a.clientOrganizationName.localeCompare(b.clientOrganizationName));

    return groups;
}
