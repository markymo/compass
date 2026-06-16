"use server";

import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition, listAllMasterFields } from "@/services/masterData/definitionService";
import { getComplexFieldConfig } from "@/lib/master-data/complex-field-config";
import { SourceType } from "@prisma/client";

// KycWriteService is deprecated in favor of FieldClaimService

/**
 * Manually updates a field, overriding any automated feeds.
 * Sets source to USER_INPUT.
 */
export async function updateFieldManually(
    clientLEId: string,
    fieldNo: number,
    value: any,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
): Promise<{ success: boolean; message?: string; claimId?: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;

        if (!userId) {
            return { success: false, message: "Authentication required for manual updates." };
        }
        // Reason is now optional

        // 1. Resolve Subject and Scope
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId }
        });
        const subjectLeId = clientLE?.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        if (!subjectLeId) {
            return { success: false, message: "Could not resolve LegalEntity subject." };
        }

        // 2. Map value to correct slot based on FieldDefinition
        const def = await getMasterFieldDefinition(fieldNo);
        const complexCfg = getComplexFieldConfig(fieldNo);
        const collectionId = def.isMultiValue
            ? (complexCfg?.collectionId || def.categoryId || 'GENERAL')
            : undefined;

        const claimInput: any = {
            fieldNo,
            subjectLeId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            sourceReference: reason,
            collectionId,
            instanceId: rowId // For multi-value, rowId is the stable instance key
        };

        // Assign value to the correct slot
        switch (def.appDataType) {
            case 'TEXT':
            case 'SELECT': // Option-set fields store the selected value as text
                claimInput.valueText = value; break;
            case 'NUMBER': claimInput.valueNumber = value; break;
            case 'DATE':
            case 'DATETIME': claimInput.valueDate = new Date(value); break;
            case 'PERSON_REF': claimInput.valuePersonId = value; break;
            case 'ORG_REF': claimInput.valueLeId = value; break;
            case 'ADDRESS_REF': claimInput.valueAddressId = value; break;
            case 'DOCUMENT_REF': claimInput.valueText = value; break; // Manual edits store as text; valueDocId requires valid FK
            case 'PARTY_REF':
            case 'JSONB':
            case 'ADDRESS':
            case 'PARTY':
            case 'PERSON_OR_CONTACT':
                claimInput.valueJson = value; break;
        }

        const claim = await FieldClaimService.assertClaim({
            ...claimInput,
            clientLEId,  // required for graph edge write-back on graph-bound fields (e.g. F63 DIRECTOR)
            verifiedByUserId: userId,
            status: SourceType.USER_INPUT === SourceType.USER_INPUT ? 'VERIFIED' : 'ASSERTED' // manual updates are verified
        });

        if (claim) {
            revalidatePath(`/app/le/${clientLEId}`, 'layout');
            return { success: true, claimId: claim.id };
        } else {
            return { success: false, message: "Update failed." };
        }
    } catch (error: any) {
        console.error("updateFieldManually error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Alias for updateFieldManually to match frontend usage.
 * ROUTING LOGIC: Checks if 'fieldNo' refers to a Standard Field or Custom Field.
 */
export async function applyManualOverride(
    leId: string,
    fieldNo: string | number, // Frontend passes string sometimes?
    value: any,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
) {
    // Get real userId from session
    const identity = await getIdentity();
    const userId = identity?.userId || "SYSTEM_USER";

    const num = Number(fieldNo);

    // 1. Try Standard Field Update
    // We check if it's a valid number AND exists in definitions.
    if (!isNaN(num) && num > 0) {
        try {
            await getMasterFieldDefinition(num);
            return updateFieldManually(leId, num, value, reason, rowId, entityType);
        } catch (e) {
            // Not a standard field, fall through to custom
        }
    }

    // 2. Fallback to Custom Field Update
    // If not a standard field ID, assume it's a Custom Field Key.
    return updateCustomFieldManually(leId, String(fieldNo), value, reason);
}

/**
 * Promotes a specific claim to be the authoritative winner.
 * Creates a new USER_INPUT claim with the same value, effectively overriding.
 */
export async function promoteClaim(
    clientLEId: string,
    claimId: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
): Promise<{ success: boolean; message?: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) return { success: false, message: "Authentication required." };

        // 1. Fetch the claim to promote
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) return { success: false, message: "Claim not found." };

        const val = (claim.valueText ?? claim.valueNumber ?? claim.valueDate ?? claim.valueJson ?? claim.valueLeId ?? claim.valuePersonId ?? claim.valueOrgId ?? claim.valueDocId) ?? null;

        // 2. Assert as a new verified manual claim
        return await updateFieldManually(
            clientLEId,
            claim.fieldNo,
            val,
            `Promoted from ${claim.sourceType}`,
            rowId || claim.instanceId || undefined,
            entityType
        );
    } catch (error: any) {
        console.error("promoteClaim error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Reverts/Applies a specific candidate value.
 * This effectively "Accepts" a candidate.
 */
export async function applyCandidate(
    clientLEId: string,
    candidatePayload: any,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
): Promise<{ success: boolean; message?: string }> {
    try {
        // In the new architecture, applying a candidate means asserting it as a USER_INPUT claim
        // This is a simplified version:
        return await updateFieldManually(
            clientLEId,
            candidatePayload.fieldNo,
            candidatePayload.value,
            "Accepted candidate value",
            rowId,
            entityType
        );
    } catch (error: any) {
        console.error("applyCandidate error:", error);
        return { success: false, message: error.message };
    }
}

export async function applyFieldCandidate(
    leId: string,
    candidate: any
) {
    return applyCandidate(leId, candidate);
}
export async function updateCustomFieldManually(
    clientLEId: string,
    fieldKey: string,
    value: any,
    reason: string
) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;

        if (!userId) {
            return { success: false, message: "Authentication required for custom field updates." };
        }
        const le = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!le) return { success: false, message: "LE not found" };

        const currentData = (le.customData as Record<string, any>) || {};

        // Update structure
        const newData = {
            ...currentData,
            [fieldKey]: {
                value: value,
                source: "USER_INPUT",
                timestamp: new Date().toISOString(),
                updatedBy: userId,
                reason: reason
            }
        };

        await prisma.clientLE.update({
            where: { id: clientLEId },
            data: { customData: newData }
        });

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };

    } catch (e: any) {
        console.error("Failed to update custom field:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Adds a new value to a multi-value field.
 * Generates a fresh instanceId and asserts a real value (not a placeholder).
 */
export async function addMultiValueEntry(
    clientLEId: string,
    fieldNo: number,
    value: any,
    reason?: string
): Promise<{ success: boolean; message?: string; claimId?: string }> {
    try {
        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) return { success: false, message: "Field is not multi-value" };

        if (!value || (typeof value === 'string' && !value.trim())) {
            return { success: false, message: "A value is required" };
        }

        const instanceId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const result = await updateFieldManually(
            clientLEId,
            fieldNo,
            typeof value === 'string' ? value.trim() : value,
            reason || "Added new entry",
            instanceId,
            'CLIENT_LE'
        );

        if (result.success) {
            return { success: true, claimId: instanceId };
        }
        return result;
    } catch (e: any) {
        console.error("addMultiValueEntry error:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Removes a value from a multi-value field by emitting a tombstone claim.
 * The value is soft-deleted — it won't appear in getAuthoritativeCollection results.
 */
export async function removeMultiValueEntry(
    clientLEId: string,
    fieldNo: number,
    claimId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) {
            return { success: false, message: "Authentication required." };
        }

        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) return { success: false, message: "Field is not multi-value" };

        // 1. Check for Graph Binding
        const bindings = await prisma.masterFieldGraphBinding.findMany({
            where: { fieldNo, isActive: true }
        });
        const graphBinding = bindings.find((b: any) => b.writeBackEdgeType);

        // 2. Resolve subject/scope
        const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        const subjectLeId = clientLE?.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        if (!subjectLeId) {
            return { success: false, message: "Could not resolve subject." };
        }

        // 3. Handle Graph Edge Deactivation
        if (graphBinding) {
            const edge = await prisma.clientLEGraphEdge.findUnique({ where: { id: claimId } });
            if (edge) {
                await prisma.clientLEGraphEdge.update({
                    where: { id: claimId },
                    data: { isActive: false }
                });

                // Also emit tombstone for Master Data consistency
                await FieldClaimService.emitTombstone(
                    { subjectLeId },
                    fieldNo,
                    def.categoryId || 'GENERAL',
                    claimId, // Use edge ID as instanceId for graph-bound fields
                    ownerScopeId
                );

                revalidatePath(`/app/le/${clientLEId}`, 'layout');
                return { success: true };
            }
        }

        // 4. Standard path: Look up the claim to get collectionId and instanceId
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) {
            return { success: false, message: "Claim not found" };
        }

        if (!claim.instanceId) {
            return { success: false, message: "Cannot remove: claim has no instanceId" };
        }

        // Emit tombstone
        const tombstone = await FieldClaimService.emitTombstone(
            { subjectLeId },
            fieldNo,
            claim.collectionId || def.categoryId || 'GENERAL',
            claim.instanceId,
            ownerScopeId
        );

        // Auto-verify user deletions for immediate effect
        await FieldClaimService.verifyClaim(tombstone.id, userId);

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (e: any) {
        console.error("removeMultiValueEntry error:", e);
        return { success: false, message: e.message };
    }
}

export async function applyBulkOverride(
    clientLEId: string,
    modelName: string,
    updates: Record<string, any>,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
) {
    const identity = await getIdentity();
    const userId = identity?.userId || "SYSTEM_USER";
    try {
        const allFields = await listAllMasterFields();
        const fieldNos = allFields
            .filter((f: any) => f.masterDataCategory?.displayName === modelName)
            .map((f: any) => f.fieldNo);

        for (const [fieldName, value] of Object.entries(updates)) {
            const def = allFields.find((f: any) => f.masterDataCategory?.displayName === modelName && f.fieldName === fieldName);
            if (def) {
                await updateFieldManually(clientLEId, def.fieldNo, value, reason, rowId, entityType);
            }
        }

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (error: any) {
        console.error("applyBulkOverride error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Adds an entry to a controlled-vocabulary code-list collection (e.g. SIC codes).
 *
 * The client sends ONLY: clientLEId, fieldNo, codeSystem, and the code string.
 * The server:
 *   1. Validates the fieldNo resolves to a STRUCTURED_COLLECTION with the claimed codeSystem.
 *   2. Validates the code exists in the code system reference data.
 *   3. Resolves the label server-side — never trusts a client-supplied label.
 *   4. Checks that the code is not already active (duplicate check on active rows only;
 *      tombstoned/deleted codes are selectable again).
 *   5. Writes a USER_INPUT FieldClaim via updateFieldManually.
 *
 * Returns { success: false } with a user-facing message for all validation failures.
 */
export async function addCodeListEntry(
    clientLEId: string,
    fieldNo: number,
    codeSystem: string,
    code: string
): Promise<{ success: boolean; message?: string; instanceId?: string }> {
    // ── 1. Validate fieldNo + codeSystem match the config ──────────────────
    const { getComplexFieldConfig } = await import('@/lib/master-data/complex-field-config');
    const config = getComplexFieldConfig(fieldNo);
    if (!config || config.kind !== 'STRUCTURED_COLLECTION') {
        return { success: false, message: 'Field is not a structured collection.' };
    }
    if (config.codeSystem !== codeSystem) {
        return { success: false, message: `Code system mismatch for field ${fieldNo}.` };
    }

    // ── 2. Validate code against reference data (server-side) ──────────────
    const { getCodeSystemConfig } = await import('@/lib/master-data/code-systems');
    const sysConfig = getCodeSystemConfig(codeSystem);
    if (!sysConfig) {
        return { success: false, message: `Unknown code system: ${codeSystem}.` };
    }

    const { getCodeSystemEntries } = await import('@/actions/code-system');
    const allEntries = await getCodeSystemEntries(codeSystem);
    const matched = allEntries.find(e => e.code === code.trim());
    if (!matched) {
        return { success: false, message: `Unknown code: ${code}` };
    }

    // ── 3. Label is resolved from the server — client-supplied label ignored ──
    const resolvedLabel = matched.label;

    // ── 4. Duplicate check — active rows only ───────────────────────────────
    // Tombstoned codes are not considered duplicates (user can re-add after removing).
    const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
    const subjectLeId = clientLE?.legalEntityId;
    if (!subjectLeId) {
        return { success: false, message: 'Could not resolve legal entity.' };
    }

    const activeRows = await KycStateService.getAuthoritativeCollection(
        { subjectLeId },
        fieldNo
    );
    const instanceId = `${sysConfig.instanceIdPrefix}${code.trim()}`;
    const alreadyActive = activeRows.some(r => r.instanceId === instanceId);
    if (alreadyActive) {
        return { success: false, message: 'This code has already been added.' };
    }

    // ── 5. Write USER_INPUT claim ───────────────────────────────────────────
    const result = await updateFieldManually(
        clientLEId,
        fieldNo,
        { code: code.trim(), label: resolvedLabel },
        'User added code via picker',
        instanceId,
        'CLIENT_LE'
    );

    if (result.success) {
        return { success: true, instanceId };
    }
    return result;
}

export async function addExistingCCPartyReferenceToField(
    clientLEId: string,
    fieldNo: number,
    ccPartyId: string,
    rowId?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);

        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        if (fieldNo === 63) {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: clientLEId },
                include: { legalEntity: true }
            });
            if (!clientLE) {
                return { success: false, message: "ClientLE not found" };
            }

            const existingParty = await prisma.cCParty.findUnique({
                where: { id: ccPartyId }
            });
            if (existingParty) {
                const partyData = existingParty.data as any || {};
                const enrichedData = enrichCCPartyRolesForField63(clientLE, partyData);
                
                if (JSON.stringify(partyData) !== JSON.stringify(enrichedData)) {
                    await prisma.cCParty.update({
                        where: { id: ccPartyId },
                        data: { data: enrichedData }
                    });
                }
            }
        }

        const actualRowId = rowId || `ccparty_${ccPartyId}`;

        const claimResult = await updateFieldManually(
            clientLEId,
            fieldNo,
            { ccPartyId },
            `Added existing party via Field ${fieldNo} — ${def.fieldName}`,
            actualRowId,
            'CLIENT_LE'
        );

        if (!claimResult.success) {
            return claimResult;
        }

        const { revalidatePath } = await import('next/cache');
        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (error: any) {
        console.error("addExistingCCPartyReferenceToField error:", error);
        return { success: false, message: error.message };
    }
}

export async function createCCPartyAndReferenceField(
    clientLEId: string,
    fieldNo: number,
    partyValueData: any,
    rowId?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);
        const originLabel = `Created manually from Field ${fieldNo} — ${def.fieldName}`;

        const { getIdentity } = await import('@/lib/auth');
        const identity = await getIdentity();
        if (!identity?.userId) {
            return { success: false, message: "Unauthorized" };
        }

        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: { legalEntity: true }
        });
        if (!clientLE) {
            return { success: false, message: "ClientLE not found" };
        }

        let enrichedPartyData = partyValueData;
        if (fieldNo === 63) {
            enrichedPartyData = enrichCCPartyRolesForField63(clientLE, partyValueData);
        }

        const newParty = await prisma.$transaction(async (tx: any) => {
            const party = await tx.cCParty.create({
                data: {
                    clientLEId,
                    data: enrichedPartyData,
                    visibility: "CLIENT_LE",
                    createdByUserId: identity.userId,
                    updatedByUserId: identity.userId
                }
            });
            return party;
        });

        const actualRowId = rowId || `ccparty_${newParty.id}`;

        const claimResult = await updateFieldManually(
            clientLEId,
            fieldNo,
            { ccPartyId: newParty.id },
            originLabel,
            actualRowId,
            'CLIENT_LE'
        );

        if (!claimResult.success) {
            await prisma.cCParty.delete({ where: { id: newParty.id } });
            return { success: false, message: claimResult.message || "Failed to link new party to field" };
        }

        await prisma.cCParty.update({
            where: { id: newParty.id },
            data: { createdFromClaimId: claimResult.claimId }
        });

        const { revalidatePath } = await import('next/cache');
        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };

    } catch (error: any) {
        console.error("createCCPartyAndReferenceField error:", error);
        return { success: false, message: error.message };
    }
}

function enrichCCPartyRolesForField63(clientLE: any, partyData: any): any {
    const data = partyData || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const hasActiveDirectorRole = roles.some((role: any) =>
        role.roleType === "director" &&
        role.company?.coparityCompanyId === clientLE.id &&
        role.isActiveRole !== false
    );

    if (hasActiveDirectorRole) {
        return data;
    }

    const companyName = clientLE.name;
    const coparityCompanyId = clientLE.id;
    let externalId = null;
    let externalIdScheme = null;

    if (clientLE.lei) {
        externalId = clientLE.lei;
        externalIdScheme = "LEI";
    } else if (clientLE.legalEntity?.localRegistrationNumber) {
        externalId = clientLE.legalEntity.localRegistrationNumber;
        externalIdScheme = "LOCAL_REGISTRATION_NUMBER";
    }

    const newRole = {
        roleType: "director",
        roleTitle: "Director",
        isActiveRole: true,
        appointedOn: null,
        resignedOn: null,
        natureOfControl: [],
        company: {
            name: companyName,
            coparityCompanyId: coparityCompanyId,
            externalId,
            externalIdScheme
        }
    };

    return {
        ...data,
        roles: [...roles, newRole]
    };
}
