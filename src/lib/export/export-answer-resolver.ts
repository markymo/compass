import { KycStateService } from "@/lib/kyc/KycStateService";
import { getFieldDetail, enrichPartyReferences, enrichAddressReferences } from "@/actions/kyc-query";
import { getSourceDisplayName } from "@/lib/source-display";
import prisma from "@/lib/prisma";

export interface ExportAnswerResult {
    displayValue: string;
    rawValue: any;
    answerState: string;
    sourceLabel?: string;
    sourceTimestamp?: Date | string | null;
    sourceUserName?: string | null;
    provenanceSummary?: string;
    sourceCategory?: 'REGISTRY' | 'USER' | 'DEFAULT' | 'NO_RESPONSE' | 'SYSTEM';
}

import { toExportText } from "@/lib/export/toExportText";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";

export async function resolveExportAnswer(
    question: any, 
    subjectLeId?: string, 
    ownerScopeId?: string,
    entityId?: string
): Promise<ExportAnswerResult> {
    const isReleased = question.status === 'RELEASED';
    const snapshotDate = isReleased ? question.releasedAt : undefined;
    const releasedByName = question.releasedByUser?.name || question.releasedByUser?.email || null;

    if (question.masterFieldNo && subjectLeId && entityId) {
        // Fetch field detail first
        const fieldDetail = await getFieldDetail(entityId, question.masterFieldNo, "CLIENT_LE");

        let derivedValueToDisplay: any = null;
        let primaryDerived: any = null;

        if (fieldDetail.isRepeating) {
            const collection = await KycStateService.getAuthoritativeCollection(
                { subjectLeId, clientLEId: entityId },
                question.masterFieldNo,
                ownerScopeId || undefined,
                snapshotDate
            );
            if (collection && collection.length > 0) {
                derivedValueToDisplay = collection.map(c => c.value);
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

        if (primaryDerived && derivedValueToDisplay !== null && derivedValueToDisplay !== undefined && derivedValueToDisplay !== "" && (!Array.isArray(derivedValueToDisplay) || derivedValueToDisplay.length > 0)) {
            const valuesToEnrich = Array.isArray(derivedValueToDisplay) ? derivedValueToDisplay : [derivedValueToDisplay];
            await enrichPartyReferences(valuesToEnrich);
            await enrichAddressReferences(valuesToEnrich);

            const displayModel = resolveFieldForDisplay(
                derivedValueToDisplay,
                {
                    type: primaryDerived.sourceType as any,
                    reference: primaryDerived.sourceReference,
                    timestamp: primaryDerived.assertedAt,
                    sourceCheckedAt: primaryDerived.sourceCheckedAt || primaryDerived.assertedAt,
                    userName: null
                },
                {
                    fieldNo: question.masterFieldNo,
                    label: "Export Field", // Not used by toExportText, but required by metadata
                    displayState: "HAS_VALUE",
                    appDataType: fieldDetail.dataType,
                    profileConfig: fieldDetail.profileConfig
                }
            );
            const displayValue = toExportText(displayModel);
            
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
                sourceCategory
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
    } else {
        // Unmapped questionnaire answer
        if (question.answer) {
            let parsedAnswer = question.answer;
            if (typeof parsedAnswer === 'string') {
                try {
                    parsedAnswer = JSON.parse(parsedAnswer);
                } catch (e) { }
            }

            const valuesToEnrich = [parsedAnswer];
            await enrichPartyReferences(valuesToEnrich);
            await enrichAddressReferences(valuesToEnrich);

            const displayModel = resolveFieldForDisplay(
                parsedAnswer,
                null,
                {
                    fieldNo: -1,
                    label: "Unmapped Question",
                    displayState: "HAS_VALUE"
                }
            );
            const displayValue = toExportText(displayModel);
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
