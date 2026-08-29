"use server";

import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition, listAllMasterFields } from "@/services/masterData/definitionService";
import { getComplexFieldConfig } from "@/lib/master-data/complex-field-config";
import { SourceType } from "@prisma/client";

import * as Sentry from "@sentry/nextjs";
import { ActionDomainError, handleActionError } from "@/lib/action-error-handler";

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
): Promise<{ success: boolean; message?: string; claimId?: string; kind?: 'domain' | 'unexpected'; errorRef?: string; timestamp?: string; operation?: string; technicalDetails?: string }> {
    return await Sentry.startSpan(
        {
            name: "probe.field_claim.save",
            op: "function.kyc_update",
            attributes: {
                "probe.name": "field_claim.save",
                "probe.type": "standard_write",
                "field.no": fieldNo,
            },
        },
        async () => {
            try {
                const identity = await getIdentity();
                const userId = identity?.userId;

                if (!userId) {
                    throw new ActionDomainError("Authentication required for manual updates.");
                }

                // 1. Resolve Subject and Scope
                const clientLE = await prisma.clientLE.findUnique({
                    where: { id: clientLEId }
                });
                if (!clientLE) {
                    throw new ActionDomainError("ClientLE not found.");
                }
                const subjectLeId = clientLE.legalEntityId ?? null;
                const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

                // 2. Map value to correct slot based on FieldDefinition
                const def = await getMasterFieldDefinition(fieldNo);

                if (['PARTY', 'PARTY_REF'].includes(def.appDataType) && (def.profileConfig as any)?.partyPopulationPolicy === 'SYSTEM_ONLY') {
                    throw new ActionDomainError(`Field ${fieldNo} is locked to authoritative sources. Manual curation is disabled.`);
                }

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
                if (value && typeof value === 'object' && value.explicitNone) {
                    claimInput.valueJson = value;
                } else {
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
                    case 'BOOLEAN': {
                        let boolVal: boolean;
                        if (typeof value === 'boolean') {
                            boolVal = value;
                        } else if (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes')) {
                            boolVal = true;
                        } else if (typeof value === 'string' && (value.toLowerCase() === 'false' || value.toLowerCase() === 'no')) {
                            boolVal = false;
                        } else {
                            throw new ActionDomainError("Invalid boolean value. Must be a boolean (true/false).");
                        }
                        claimInput.valueJson = boolVal;
                        break;
                    }
                    case 'PARTY_REF':
                    case 'JSONB':
                    case 'ADDRESS':
                    case 'PARTY':
                    case 'PERSON_OR_CONTACT':
                        claimInput.valueJson = value; break;
                    }
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
                    throw new ActionDomainError("Update failed.");
                }
            } catch (error: any) {
                return handleActionError(error, {
                    operation: "Save Master field",
                    fallbackMessage: "We couldn’t save this field.",
                    context: { clientLEId, fieldNo, rowId, entityType }
                });
            }
        }
    );
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
) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) throw new ActionDomainError("Authentication required.");

        // 1. Fetch the claim to promote
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) throw new ActionDomainError("Claim not found.");

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
        return handleActionError(error, {
            operation: "Promote claim",
            fallbackMessage: "We couldn’t promote this value.",
            context: { clientLEId, rowId, entityType }
        });
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
) {
    try {
        return await updateFieldManually(
            clientLEId,
            candidatePayload.fieldNo,
            candidatePayload.value,
            "Accepted candidate value",
            rowId,
            entityType
        );
    } catch (error: any) {
        return handleActionError(error, {
            operation: "Apply candidate value",
            fallbackMessage: "We couldn’t apply this candidate value.",
            context: { clientLEId, fieldNo: candidatePayload?.fieldNo, rowId, entityType }
        });
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
            throw new ActionDomainError("Authentication required for custom field updates.");
        }
        const le = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!le) throw new ActionDomainError("LE not found");

        const currentData = (le.customData as Record<string, any>) || {};

        // Update structure
        const newData = { ...currentData };
        if (value === "" || value === null || value === undefined) {
            delete newData[fieldKey];
        } else {
            newData[fieldKey] = {
                value: value,
                source: "USER_INPUT",
                timestamp: new Date().toISOString(),
                updatedBy: userId,
                reason: reason
            };
        }

        await prisma.clientLE.update({
            where: { id: clientLEId },
            data: { customData: newData }
        });

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };

    } catch (e: any) {
        return handleActionError(e, {
            operation: "Save custom field",
            fallbackMessage: "We couldn’t save this custom field.",
            context: { clientLEId, customFieldId: fieldKey }
        });
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
) {
    try {
        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) throw new ActionDomainError("Field is not multi-value");

        if (!value || (typeof value === 'string' && !value.trim())) {
            throw new ActionDomainError("A value is required");
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
        return handleActionError(e, {
            operation: "Add collection entry",
            fallbackMessage: "We couldn’t add this item.",
            context: { clientLEId, fieldNo }
        });
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
) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) {
            throw new ActionDomainError("Authentication required.");
        }

        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) throw new ActionDomainError("Field is not multi-value");

        // 1. Check for Graph Binding
        const bindings = await prisma.masterFieldGraphBinding.findMany({
            where: { fieldNo, isActive: true }
        });
        const graphBinding = bindings.find((b: any) => b.writeBackEdgeType);

        // 2. Resolve subject/scope
        const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!clientLE) throw new ActionDomainError("ClientLE not found");
        const subjectLeId = clientLE.legalEntityId ?? null;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        // 3. Handle Graph Edge Deactivation
        if (graphBinding) {
            const edge = await prisma.clientLEGraphEdge.findUnique({ where: { id: claimId } });
            if (edge) {
                await prisma.clientLEGraphEdge.update({
                    where: { id: claimId },
                    data: { isActive: false }
                });

                await FieldClaimService.emitTombstone(
                    { subjectLeId, clientLEId },
                    fieldNo,
                    def.categoryId || 'GENERAL',
                    claimId,
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
            throw new ActionDomainError("Claim not found");
        }

        let instanceId = claim.instanceId;
        if (!instanceId) {
            instanceId = claim.id;
            await prisma.fieldClaim.update({
                where: { id: claim.id },
                data: { instanceId }
            });
        }

        const tombstone = await FieldClaimService.emitTombstone(
            { subjectLeId, clientLEId },
            fieldNo,
            claim.collectionId || def.categoryId || 'GENERAL',
            instanceId,
            ownerScopeId
        );

        await FieldClaimService.verifyClaim(tombstone.id, userId);

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Remove collection entry",
            fallbackMessage: "We couldn’t remove this item.",
            context: { clientLEId, fieldNo, instanceId: claimId }
        });
    }
}

/**
 * Clears a single-value (non-repeating) scalar field by emitting a USER_INPUT tombstone claim.
 */
export async function clearSingleValueEntry(
    clientLEId: string,
    fieldNo: number
) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) {
            throw new ActionDomainError("Authentication required.");
        }

        const def = await getMasterFieldDefinition(fieldNo);
        if (def.isMultiValue) {
            throw new ActionDomainError("Field is a multi-value collection. Use removeMultiValueEntry instead.");
        }

        const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!clientLE) throw new ActionDomainError("ClientLE not found");
        const subjectLeId = clientLE.legalEntityId ?? null;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        const tombstone = await FieldClaimService.emitTombstone(
            { subjectLeId, clientLEId },
            fieldNo,
            def.categoryId || 'GENERAL',
            'single',
            ownerScopeId
        );

        await FieldClaimService.verifyClaim(tombstone.id, userId);

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Clear field value",
            fallbackMessage: "We couldn’t clear this field.",
            context: { clientLEId, fieldNo }
        });
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
    try {
        const identity = await getIdentity();
        const userId = identity?.userId || "SYSTEM_USER";

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
        return handleActionError(error, {
            operation: "Apply bulk override",
            fallbackMessage: "We couldn’t apply this bulk update.",
            context: { clientLEId, rowId, entityType }
        });
    }
}

/**
 * Adds an entry to a controlled-vocabulary code-list collection (e.g. SIC codes).
 */
export async function addCodeListEntry(
    clientLEId: string,
    fieldNo: number,
    codeSystem: string,
    code: string
) {
    try {
        const { getComplexFieldConfig } = await import('@/lib/master-data/complex-field-config');
        const config = getComplexFieldConfig(fieldNo);
        if (!config || config.kind !== 'STRUCTURED_COLLECTION') {
            throw new ActionDomainError('Field is not a structured collection.');
        }
        if (config.codeSystem !== codeSystem) {
            throw new ActionDomainError(`Code system mismatch for field ${fieldNo}.`);
        }

        const { getCodeSystemConfig } = await import('@/lib/master-data/code-systems');
        const sysConfig = getCodeSystemConfig(codeSystem);
        if (!sysConfig) {
            throw new ActionDomainError(`Unknown code system: ${codeSystem}.`);
        }

        const { getCodeSystemEntries } = await import('@/actions/code-system');
        const allEntries = await getCodeSystemEntries(codeSystem);
        const matched = allEntries.find(e => e.code === code.trim());
        if (!matched) {
            throw new ActionDomainError(`Unknown code: ${code}`);
        }

        const resolvedLabel = matched.label;

        const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!clientLE) throw new ActionDomainError('ClientLE not found.');
        const subjectLeId = clientLE.legalEntityId ?? null;

        const activeRows = await KycStateService.getAuthoritativeCollection(
            { subjectLeId, clientLEId },
            fieldNo
        );
        const instanceId = `${sysConfig.instanceIdPrefix}${code.trim()}`;
        const alreadyActive = activeRows.some(r => r.instanceId === instanceId);
        if (alreadyActive) {
            throw new ActionDomainError('This code has already been added.');
        }

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
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Add code-list entry",
            fallbackMessage: "We couldn’t add this code entry.",
            context: { clientLEId, fieldNo, collectionId: codeSystem }
        });
    }
}

export async function addExistingCCPartyReferenceToField(
    clientLEId: string,
    fieldNo: number,
    ccPartyId: string,
    rowId?: string
) {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);

        const allowedPartyTypes = (def.profileConfig as any)?.allowedPartyTypes as Array<'INDIVIDUAL'|'ORGANISATION'|'TEAM'> | undefined;
        
        if (allowedPartyTypes !== undefined) {
            const existingParty = await prisma.cCParty.findUnique({
                where: { id: ccPartyId }
            });
            if (!existingParty) {
                 throw new ActionDomainError("Party not found.");
            }
            const data = existingParty.data as any;
            const pType = data.partyType ?? (data.contactType === 'PERSON' ? 'INDIVIDUAL' : 'INDIVIDUAL');
            if (!allowedPartyTypes.includes(pType)) {
                 throw new ActionDomainError(`Field ${fieldNo} does not allow party type ${pType}`);
            }
        }

        if (fieldNo === 63) {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: clientLEId },
                include: { legalEntity: true }
            });
            if (!clientLE) {
                throw new ActionDomainError("ClientLE not found");
            }

            const existingParty = await prisma.cCParty.findUnique({
                where: { id: ccPartyId }
            });
            if (existingParty) {
                const partyData = existingParty.data as any || {};
                if (partyData.schemaVersion === 2) {
                    const enrichedData = enrichCCPartyRolesForField63(clientLE, partyData);
                    
                    if (JSON.stringify(partyData) !== JSON.stringify(enrichedData)) {
                        const { CCPartyService } = await import("@/services/masterData/cc-party-service");
                        await CCPartyService.update({
                            ccPartyId: existingParty.id,
                            clientLEId: existingParty.clientLEId,
                            data: enrichedData
                        });
                    }
                }
            }
        }

        const actualRowId = def.isMultiValue ? (rowId || `ccparty_${ccPartyId}`) : undefined;

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
        return handleActionError(error, {
            operation: "Link party to field",
            fallbackMessage: "We couldn’t link this party.",
            context: { clientLEId, fieldNo, rowId }
        });
    }
}

export async function createCCPartyAndReferenceField(
    clientLEId: string,
    fieldNo: number,
    partyValueData: any,
    rowId?: string
) {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);
        const originLabel = `Created manually from Field ${fieldNo} — ${def.fieldName}`;

        const { getIdentity } = await import('@/lib/auth');
        const identity = await getIdentity();
        if (!identity?.userId) {
            throw new ActionDomainError("Unauthorized");
        }

        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: { legalEntity: true }
        });
        if (!clientLE) {
            throw new ActionDomainError("ClientLE not found");
        }

        let enrichedPartyData = partyValueData;
        if (fieldNo === 63) {
            enrichedPartyData = enrichCCPartyRolesForField63(clientLE, partyValueData);
        }

        const { isCCPartyData } = await import("@/lib/master-data/party-v2/CCPartyData");
        if (!isCCPartyData(enrichedPartyData)) {
            throw new ActionDomainError("Invalid CCPartyData V2 structure provided");
        }
        
        const allowedPartyTypes = (def.profileConfig as any)?.allowedPartyTypes as Array<'INDIVIDUAL'|'ORGANISATION'|'TEAM'> | undefined;
        if (allowedPartyTypes !== undefined) {
             const pType = enrichedPartyData.partyType;
             if (!allowedPartyTypes.includes(pType as any)) {
                  throw new ActionDomainError(`Field ${fieldNo} does not allow party type ${pType}`);
             }
        }

        const { CCPartyService } = await import("@/services/masterData/cc-party-service");

        const newParty = await CCPartyService.create({
            clientLEId,
            data: enrichedPartyData,
            createdByUserId: identity.userId
        });

        const actualRowId = def.isMultiValue ? (rowId || `ccparty_${newParty.id}`) : undefined;

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
            return claimResult;
        }

        await prisma.cCParty.update({
            where: { id: newParty.id },
            data: { createdFromClaimId: claimResult.claimId }
        });

        const { revalidatePath } = await import('next/cache');
        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };

    } catch (error: any) {
        return handleActionError(error, {
            operation: "Create and link party",
            fallbackMessage: "We couldn’t create and link this party.",
            context: { clientLEId, fieldNo, rowId }
        });
    }
}

function enrichCCPartyRolesForField63(clientLE: any, partyData: any): any {
    const data = partyData || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const hasActiveDirectorRole = roles.some((role: any) =>
        role.roleType === "director" &&
        role.company?.onProCompanyId === clientLE.id &&
        role.isActiveRole !== false
    );

    if (hasActiveDirectorRole) {
        return data;
    }

    const companyName = clientLE.name;
    const onProCompanyId = clientLE.id;
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
            onProCompanyId: onProCompanyId,
            externalId,
            externalIdScheme
        }
    };

    return {
        ...data,
        roles: [...roles, newRole]
    };
}

export async function addExistingCCAddressReferenceToField(
    clientLEId: string,
    fieldNo: number,
    ccAddressId: string,
    rowId?: string
) {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);

        const actualRowId = def.isMultiValue ? (rowId || `ccaddress_${ccAddressId}`) : undefined;

        const claimResult = await updateFieldManually(
            clientLEId,
            fieldNo,
            { ccAddressId },
            `Added existing saved address via Field ${fieldNo} — ${def.fieldName}`,
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
        return handleActionError(error, {
            operation: "Link address to field",
            fallbackMessage: "We couldn’t link this address.",
            context: { clientLEId, fieldNo, rowId }
        });
    }
}

export async function createCCAddressAndReferenceField(
    clientLEId: string,
    fieldNo: number,
    addressValueData: any,
    rowId?: string
) {
    try {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);
        const originLabel = `Created manually from Field ${fieldNo} — ${def.fieldName}`;

        const { getIdentity } = await import('@/lib/auth');
        const identity = await getIdentity();
        if (!identity?.userId) {
            throw new ActionDomainError("Unauthorized");
        }

        const newAddress = await prisma.$transaction(async (tx: any) => {
            const address = await tx.cCAddress.create({
                data: {
                    clientLEId,
                    data: addressValueData,
                    visibility: "CLIENT_LE",
                    createdByUserId: identity.userId,
                    updatedByUserId: identity.userId
                }
            });
            return address;
        });

        const actualRowId = def.isMultiValue ? (rowId || `ccaddress_${newAddress.id}`) : undefined;

        const claimResult = await updateFieldManually(
            clientLEId,
            fieldNo,
            { ccAddressId: newAddress.id },
            originLabel,
            actualRowId,
            'CLIENT_LE'
        );

        if (!claimResult.success) {
            await prisma.cCAddress.delete({ where: { id: newAddress.id } });
            return claimResult;
        }

        await prisma.cCAddress.update({
            where: { id: newAddress.id },
            data: { createdFromClaimId: claimResult.claimId }
        });

        const { revalidatePath } = await import('next/cache');
        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };

    } catch (error: any) {
        return handleActionError(error, {
            operation: "Create and link address",
            fallbackMessage: "We couldn’t create and link this address.",
            context: { clientLEId, fieldNo, rowId }
        });
    }
}

export async function releaseFieldDefault(
    clientLEId: string,
    fieldNo: number,
    defaultString: string
) {
    try {
        const def = await getMasterFieldDefinition(fieldNo);
        let parsedValue: any = defaultString;
        
        if (def.appDataType === 'BOOLEAN') {
            parsedValue = defaultString.toLowerCase() === 'true';
        } else if (def.appDataType === 'NUMBER') {
            parsedValue = Number(defaultString);
        } else if (['JSONB', 'PARTY', 'ADDRESS', 'PERSON_OR_CONTACT'].includes(def.appDataType)) {
            try { parsedValue = JSON.parse(defaultString); } catch (e) {}
        }
        
        return await updateFieldManually(
            clientLEId,
            fieldNo,
            parsedValue,
            "Released field default",
            undefined,
            'CLIENT_LE'
        );
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Release field default",
            fallbackMessage: "We couldn’t release this field default.",
            context: { clientLEId, fieldNo }
        });
    }
}

export async function releaseFieldAbsence(
    clientLEId: string,
    fieldNo: number,
    sourceBadge: string,
    sourceTimestamp: string | null
) {
    try {
        const snapshot = {
            explicitNone: true,
            releasedSourceBadge: sourceBadge,
            releasedSourceTimestamp: sourceTimestamp
        };
        
        return await updateFieldManually(
            clientLEId,
            fieldNo,
            snapshot,
            "Released explicit absence",
            undefined,
            'CLIENT_LE'
        );
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Release field absence",
            fallbackMessage: "We couldn’t release explicit absence.",
            context: { clientLEId, fieldNo }
        });
    }
}

export async function restoreSourceValue(
    clientLEId: string,
    fieldNo: number
) {
    try {
        const identity = await getIdentity();
        if (!identity?.userId) throw new ActionDomainError("Unauthorized");

        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { legalEntityId: true }
        });
        if (!clientLE || !clientLE.legalEntityId) throw new ActionDomainError("Legal entity not found");

        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        const def = await getMasterFieldDefinition(fieldNo);
        if (def.appDataType !== 'ADDRESS') {
            throw new ActionDomainError("Bulk restore is currently only supported for Address fields");
        }

        await prisma.fieldClaim.updateMany({
            where: {
                clientLEId: clientLEId,
                fieldNo: fieldNo,
                sourceType: 'USER_INPUT',
                status: { in: ['ASSERTED', 'VERIFIED'] }
            },
            data: {
                status: 'REJECTED'
            }
        });

        revalidatePath(`/app/le/${clientLEId}`, 'layout');
        return { success: true };
    } catch (e: any) {
        return handleActionError(e, {
            operation: "Restore source value",
            fallbackMessage: "We couldn’t restore the source value.",
            context: { clientLEId, fieldNo }
        });
    }
}
