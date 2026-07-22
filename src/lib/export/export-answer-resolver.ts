import { KycStateService } from "@/lib/kyc/KycStateService";
import { getFieldDetail, enrichPartyReferences, enrichAddressReferences } from "@/actions/kyc-query";
import { getSourceDisplayName } from "@/lib/source-display";
import prisma from "@/lib/prisma";

import { GroupDisplayStyle } from "@prisma/client";

export type ExportGroupField = {
    fieldNo: number;
    label: string;
    displayValue: string;
    order: number;
    sourceLabel?: string;
    sourceTimestamp?: string | null;
    attachmentFilenames?: string[];
};

export interface ExportAnswerResult {
    displayValue: string;
    rawValue: any;
    answerState: string;
    sourceLabel?: string;
    sourceTimestamp?: Date | string | null;
    sourceUserName?: string | null;
    provenanceSummary?: string;
    sourceCategory?: 'REGISTRY' | 'USER' | 'DEFAULT' | 'NO_RESPONSE' | 'SYSTEM';
    groupFields?: ExportGroupField[];
    groupDisplayStyle?: GroupDisplayStyle;
    attachmentFilenames?: string[];
}

import { toExportText } from "@/lib/export/toExportText";
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay, RawFieldSource, FieldInterpreterMetadata } from "@/lib/master-data/field-interpreter";
import { FieldDisplayModel } from "@/lib/master-data/field-display-model";
import { getMasterFieldGroup, getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { resolveMasterDataBatch } from "@/actions/kyc-query";
import { resolveAmalgamatedAttachments } from "@/lib/kyc/attachments";

export function parseStructuredJsonValues(derivedValue: any): any {
    if (Array.isArray(derivedValue)) {
        return derivedValue.map(v => {
            if (v && typeof v === 'object' && 'value' in v && 'source' in v) {
                // Collection envelope shape: { value, source, ... }
                const rawVal = v.value;
                if (typeof rawVal === 'string' && (rawVal.startsWith('{') || rawVal.startsWith('['))) {
                    try {
                        return { ...v, value: JSON.parse(rawVal) };
                    } catch (e) {
                        return v;
                    }
                }
                return v;
            } else if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
                try {
                    return JSON.parse(v);
                } catch (e) {
                    return v;
                }
            }
            return v;
        });
    } else if (typeof derivedValue === 'string' && (derivedValue.startsWith('{') || derivedValue.startsWith('['))) {
        try {
            return JSON.parse(derivedValue);
        } catch (e) {
            return derivedValue;
        }
    }
    return derivedValue;
}

export interface CanonicalFieldDisplayInput {
    derivedValue: any;
    primarySource: RawFieldSource | null;
    meta: FieldInterpreterMetadata;
}

export async function resolveCanonicalFieldDisplay(input: CanonicalFieldDisplayInput): Promise<{
    displayModel: FieldDisplayModel;
    displayValue: string;
    parsedDerivedValue: any;
}> {
    const { derivedValue, primarySource, meta } = input;
    const parsedDerivedValue = parseStructuredJsonValues(derivedValue);

    const valuesToEnrich = Array.isArray(parsedDerivedValue) ? parsedDerivedValue : [parsedDerivedValue];
    await enrichPartyReferences(valuesToEnrich);
    await enrichAddressReferences(valuesToEnrich);

    const isRepeating = Boolean(meta.isMultiValue);
    const isCollection = isRepeating || Array.isArray(parsedDerivedValue);

    let displayModel: FieldDisplayModel;
    if (isCollection && Array.isArray(parsedDerivedValue)) {
        displayModel = resolveFieldCollectionForDisplay(parsedDerivedValue, meta);
    } else {
        displayModel = resolveFieldForDisplay(parsedDerivedValue, primarySource, meta);
    }

    const displayValue = toExportText(displayModel);
    return { displayModel, displayValue, parsedDerivedValue };
}

export async function resolveExportAnswer(
    question: any, 
    subjectLeId?: string, 
    ownerScopeId?: string,
    entityId?: string
): Promise<ExportAnswerResult> {
    const isReleased = question.status === 'RELEASED';
    const snapshotDate = isReleased ? question.releasedAt : undefined;
    const releasedByName = question.releasedByUser?.name || question.releasedByUser?.email || null;

    if (question.masterFieldNo && entityId) {
        // Fetch field detail first
        const fieldDetail = await getFieldDetail(entityId, question.masterFieldNo, "CLIENT_LE");

        let derivedValueToDisplay: any = null;
        let primaryDerived: any = null;
        let attachmentFilenames: string[] = [];

        if (fieldDetail.isRepeating) {
            const collection = await KycStateService.getAuthoritativeCollection(
                { subjectLeId, clientLEId: entityId },
                question.masterFieldNo,
                ownerScopeId || undefined,
                snapshotDate
            );
            if (collection && collection.length > 0) {
                derivedValueToDisplay = collection.map(c => ({
                    value: c.value,
                    source: {
                        type: c.sourceType as any,
                        reference: c.sourceReference,
                        timestamp: c.assertedAt,
                        sourceCheckedAt: c.sourceCheckedAt || c.assertedAt,
                        userName: null
                    }
                }));
                primaryDerived = collection[0];
            }
        } else {
            const derived = await KycStateService.getAuthoritativeValue(
                { subjectLeId, clientLEId: entityId },
                question.masterFieldNo,
                ownerScopeId || undefined,
                snapshotDate
            );
            if (derived && derived.value !== null && derived.value !== undefined && derived.value !== "") {
                derivedValueToDisplay = derived.value;
                primaryDerived = derived;
            }
        }
        
        let resolvedValuesMap = new Map();
        if (fieldDetail.isRepeating && Array.isArray(derivedValueToDisplay)) {
             resolvedValuesMap.set(question.masterFieldNo, derivedValueToDisplay);
        } else if (primaryDerived) {
             resolvedValuesMap.set(question.masterFieldNo, primaryDerived);
        }

        const attachmentsMap = await resolveAmalgamatedAttachments({ subjectLeId, clientLEId: entityId }, [question.masterFieldNo], resolvedValuesMap);
        const derivedAttachments = attachmentsMap?.get(question.masterFieldNo) || [];
        if (derivedAttachments.length > 0) {
            attachmentFilenames = derivedAttachments
                .filter(a => a.documentId !== undefined)
                .map(a => a.displayName || 'Unknown Document');
        }

        if (primaryDerived && derivedValueToDisplay !== null && derivedValueToDisplay !== undefined && derivedValueToDisplay !== "" && (!Array.isArray(derivedValueToDisplay) || derivedValueToDisplay.length > 0)) {
            const meta = {
                fieldNo: question.masterFieldNo,
                label: "Export Field", // Not used by toExportText, but required by metadata
                displayState: "HAS_VALUE" as any,
                appDataType: fieldDetail.dataType,
                profileConfig: fieldDetail.profileConfig,
                isMultiValue: fieldDetail.isRepeating
            };

            const primarySource: RawFieldSource = {
                type: primaryDerived.sourceType as any,
                reference: primaryDerived.sourceReference,
                timestamp: primaryDerived.assertedAt,
                sourceCheckedAt: primaryDerived.sourceCheckedAt || primaryDerived.assertedAt,
                userName: null
            };

            const { displayModel, displayValue, parsedDerivedValue } = await resolveCanonicalFieldDisplay({
                derivedValue: derivedValueToDisplay,
                primarySource,
                meta
            });
            derivedValueToDisplay = parsedDerivedValue;
            
            // Resolve provenance from canonical model
            let sourceLabel = displayModel.source?.label || primaryDerived.sourceType;
            let sourceUserName: string | null = displayModel.source?.userName || null;
            let sourceTimestamp = displayModel.source?.lastValidatedAt || displayModel.source?.timestamp || primaryDerived.assertedAt;

            let sourceCategory: 'REGISTRY' | 'USER' | 'DEFAULT' | 'SYSTEM' = 'REGISTRY';
            if (primaryDerived.sourceType === 'USER_INPUT') {
                const claim = await prisma.fieldClaim.findUnique({
                    where: { id: primaryDerived.claimId },
                    include: { verifiedBy: true }
                });
                sourceUserName = claim?.verifiedBy?.name || claim?.verifiedBy?.email || null;
                sourceLabel = sourceUserName ? `User input — ${sourceUserName}` : "User input";
                sourceCategory = 'USER';
            } else if (primaryDerived.sourceReference === 'COMPANIES_HOUSE' || primaryDerived.sourceType === 'COMPANIES_HOUSE') {
                sourceCategory = 'REGISTRY';
            } else if (primaryDerived.sourceType === 'GLEIF') {
                sourceCategory = 'REGISTRY';
            } else if (primaryDerived.sourceType === 'REGISTRATION_AUTHORITY' || primaryDerived.sourceType === 'NATIONAL_REGISTRY') {
                sourceCategory = 'REGISTRY';
            } else if (primaryDerived.sourceType === 'SYSTEM_DERIVED' || primaryDerived.sourceType === 'AI_EXTRACTION') {
                sourceCategory = 'SYSTEM';
            } else {
                sourceCategory = 'SYSTEM';
            }

            // Apply human-readable naming conventions centrally
            sourceLabel = getSourceDisplayName(primaryDerived.sourceType, primaryDerived.sourceReference);
            if (primaryDerived.sourceType === 'USER_INPUT' && sourceUserName) {
                sourceLabel = `User input — ${sourceUserName}`;
            }

            return {
                displayValue,
                rawValue: derivedValueToDisplay,
                answerState: (!Array.isArray(derivedValueToDisplay) && derivedValueToDisplay.explicitNone === true) ? "EMPTY_CHECKED" : "HAS_VALUE",
                sourceLabel,
                sourceTimestamp,
                sourceUserName,
                sourceCategory,
                attachmentFilenames: attachmentFilenames.length > 0 ? attachmentFilenames : undefined
            };
        } else {
            // Check Master Record empty state logic
            const fieldDetail = await getFieldDetail(entityId, question.masterFieldNo, "CLIENT_LE");
            
            if (fieldDetail.displayState === 'CHECKED_NO_DATA' || fieldDetail.current?.value?.explicitNone === true) {
                let sourceLabel: string | undefined = fieldDetail.current?.source ? getSourceDisplayName(fieldDetail.current.source, fieldDetail.current.sourceReference) : undefined;
                let sourceCategory: 'REGISTRY' | 'USER' | 'DEFAULT' = 'REGISTRY';
                
                if (fieldDetail.current?.source === 'USER_INPUT') {
                    sourceCategory = 'USER';
                }

                return {
                    displayValue: "None",
                    rawValue: null,
                    answerState: "EMPTY_CHECKED",
                    sourceLabel: sourceLabel || undefined,
                    sourceTimestamp: fieldDetail.current?.timestamp || null,
                    sourceCategory: isReleased ? 'USER' : sourceCategory
                };
            } else if (fieldDetail.displayState === 'DEFAULT_RESPONSE' && fieldDetail.defaultResponse) {
                if (isReleased) {
                    return {
                        displayValue: fieldDetail.defaultResponse,
                        rawValue: fieldDetail.defaultResponse,
                        answerState: "EMPTY_DEFAULT",
                        sourceLabel: releasedByName ? `Released by ${releasedByName}` : "Released by user",
                        sourceTimestamp: snapshotDate || null,
                        sourceUserName: releasedByName,
                        sourceCategory: 'USER'
                    };
                } else {
                    return {
                        displayValue: fieldDetail.defaultResponse,
                        rawValue: fieldDetail.defaultResponse,
                        answerState: "EMPTY_DEFAULT",
                        sourceLabel: "Field default",
                        sourceTimestamp: null,
                        sourceCategory: 'DEFAULT'
                    };
                }
            } else {
                return {
                    displayValue: "No response recorded",
                    rawValue: null,
                    answerState: "NO_RESPONSE",
                    sourceCategory: 'NO_RESPONSE'
                };
            }
        }
    } else if (question.masterQuestionGroupId && entityId) {
        const group = await getMasterFieldGroup(question.masterQuestionGroupId);
        if (group && group.items && group.items.length > 0) {
            const fieldNos = group.items.map((i: any) => i.fieldNo);

            const [claims, sourceMappings] = await Promise.all([
                prisma.fieldClaim.findMany({
                    where: {
                        subjectLeId: subjectLeId || '',
                        fieldNo: { in: fieldNos },
                        claimRole: 'VALUE',
                        status: { in: ['VERIFIED', 'ASSERTED'] },
                        OR: [{ ownerScopeId: ownerScopeId || null }, { ownerScopeId: null }]
                    },
                    orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
                }),
                (prisma as any).sourceFieldMapping.findMany({
                    where: { targetFieldNo: { in: fieldNos }, isActive: true }
                })
            ]);

            const fieldDefMap = new Map();
            for (const item of group.items) {
                const def = await getMasterFieldDefinition(item.fieldNo);
                if (def) {
                    fieldDefMap.set(def.fieldNo, {
                        fieldNo: def.fieldNo,
                        fieldName: def.fieldName,
                        appDataType: def.appDataType,
                        isMultiValue: def.isMultiValue,
                        profileConfig: def.profileConfig
                    });
                }
            }

            const groupFieldMap = new Map();
            groupFieldMap.set(question.masterQuestionGroupId, fieldNos);

            const batchInput = {
                subjectLeId: subjectLeId || '',
                ownerScopeId: ownerScopeId ?? null,
                questions: [{ questionId: question.id, masterQuestionGroupId: question.masterQuestionGroupId, masterFieldProjectionPath: question.masterFieldProjectionPath }],
                fieldDefMap,
                groupFieldMap,
                claims: claims as any,
                sourceMappings,
                attachmentsByField: undefined,
                provenanceMap: null,
            };

            const resolvedValues = await resolveMasterDataBatch(batchInput);
            const hydratedValues = resolvedValues[question.id] || {};

            const resolvedValuesMap = new Map();
            for (const [fieldNo, hydrated] of Object.entries(hydratedValues)) {
                resolvedValuesMap.set(Number(fieldNo), { value: (hydrated as any).value });
            }
            const attachmentsMap = await resolveAmalgamatedAttachments({ subjectLeId, clientLEId: entityId }, fieldNos, resolvedValuesMap);

            const fields: ExportGroupField[] = [];
            for (const item of group.items) {
                const hv = hydratedValues[item.fieldNo];
                const def = fieldDefMap.get(item.fieldNo);
                if (!def) continue;

                let displayValue = "None";
                let sourceLabel: string | undefined = undefined;
                let sourceTimestamp: string | null = null;
                let attachmentFilenames: string[] = [];

                if (hv && hv.value !== null && hv.value !== undefined && hv.value !== "") {
                    const attachments = attachmentsMap.get(item.fieldNo) || [];
                    if (attachments.length > 0) {
                        attachmentFilenames = attachments.map((a: any) => a.displayName);
                    }

                    const meta = {
                        fieldNo: def.fieldNo,
                        label: def.fieldName,
                        displayState: "HAS_VALUE" as const,
                        appDataType: def.appDataType,
                        profileConfig: def.profileConfig,
                        isMultiValue: def.isMultiValue
                    };

                    const primarySource: RawFieldSource = {
                        type: hv.source,
                        reference: hv.sourceReference,
                        timestamp: hv.updatedAt,
                        sourceCheckedAt: hv.sourceCheckedAt,
                        userName: null
                    };

                    const { displayModel, displayValue: resolvedText } = await resolveCanonicalFieldDisplay({
                        derivedValue: hv.value,
                        primarySource,
                        meta
                    });

                    displayValue = resolvedText;
                    sourceLabel = displayModel.source?.label || (hv.source ? getSourceDisplayName(hv.source, hv.sourceReference || undefined) : undefined);
                    const rawTimestamp = displayModel.source?.lastValidatedAt || displayModel.source?.timestamp || hv.updatedAt || null;
                    sourceTimestamp = rawTimestamp ? (rawTimestamp instanceof Date ? rawTimestamp.toISOString() : new Date(rawTimestamp).toISOString()) : null;
                }

                if (displayValue !== "None" && displayValue !== "") {
                    fields.push({
                        fieldNo: item.fieldNo,
                        label: def.fieldName,
                        displayValue,
                        order: item.order,
                        sourceLabel,
                        sourceTimestamp,
                        attachmentFilenames: attachmentFilenames.length > 0 ? attachmentFilenames : undefined
                    });
                }
            }

            const isEmpty = fields.length === 0;
            
            return {
                displayValue: isEmpty ? "No response recorded" : "Group data",
                rawValue: fields,
                answerState: isEmpty ? "NO_RESPONSE" : "HAS_VALUE",
                sourceCategory: isEmpty ? 'NO_RESPONSE' : 'USER',
                groupFields: isEmpty ? undefined : fields,
                groupDisplayStyle: group.displayStyle || 'LIST'
            };
        } else {
            return {
                displayValue: "No response recorded",
                rawValue: null,
                answerState: "NO_RESPONSE",
                sourceCategory: 'NO_RESPONSE'
            };
        }
    } else {
        // Unmapped questionnaire answer
        if (question.answer) {
            const { displayModel, displayValue, parsedDerivedValue: parsedAnswer } = await resolveCanonicalFieldDisplay({
                derivedValue: question.answer,
                primarySource: null,
                meta: {
                    fieldNo: -1,
                    label: "Unmapped Question",
                    displayState: "HAS_VALUE"
                }
            });
            if (displayValue.trim() === "") {
                return {
                    displayValue: "No response recorded",
                    rawValue: parsedAnswer,
                    answerState: "NO_RESPONSE",
                    sourceCategory: 'NO_RESPONSE'
                };
            }
            
            if (isReleased) {
                return {
                    displayValue,
                    rawValue: parsedAnswer,
                    answerState: "HAS_VALUE",
                    sourceLabel: releasedByName ? `Released by ${releasedByName}` : "Released by user",
                    sourceTimestamp: snapshotDate || null,
                    sourceUserName: releasedByName,
                    sourceCategory: 'USER'
                };
            } else {
                return {
                    displayValue,
                    rawValue: parsedAnswer,
                    answerState: "HAS_VALUE",
                    sourceLabel: "Questionnaire answer",
                    sourceTimestamp: question.updatedAt || null,
                    sourceCategory: 'USER'
                };
            }
        } else {
            return {
                displayValue: "No response recorded",
                rawValue: null,
                answerState: "NO_RESPONSE",
                sourceCategory: 'NO_RESPONSE'
            };
        }
    }
}
