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

export async function formatExportValue(rawValue: any): Promise<string> {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
        return "";
    }

    if (Array.isArray(rawValue)) {
        const formattedItems = await Promise.all(rawValue.map(item => formatExportValue(item)));
        return formattedItems.filter(Boolean).join("; ");
    }

    if (typeof rawValue === "object") {
        const clonedValue = JSON.parse(JSON.stringify(rawValue));

        if (clonedValue.explicitNone === true) {
            return "None";
        }

        if (clonedValue.ccPartyId) {
            const arr = [clonedValue];
            await enrichPartyReferences(arr);
            if (arr[0].resolvedSummary) {
                return arr[0].resolvedSummary;
            }
        }

        if (clonedValue.ccAddressId) {
            const arr = [clonedValue];
            await enrichAddressReferences(arr);
            if (arr[0].resolvedSummary) {
                return arr[0].resolvedSummary;
            }
        }

        if (clonedValue.addressLines || clonedValue.locality || clonedValue.postalCode || clonedValue.countryCode) {
            const parts = [
                ...(Array.isArray(clonedValue.addressLines) ? clonedValue.addressLines : []),
                clonedValue.locality,
                clonedValue.region,
                clonedValue.postalCode,
                clonedValue.countryName || clonedValue.countryCode
            ].filter(Boolean);
            if (parts.length > 0) {
                return parts.join(", ");
            }
        }

        try {
            return Object.entries(clonedValue)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
        } catch (e) {
            return JSON.stringify(rawValue);
        }
    }

    return String(rawValue);
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

    if (question.masterFieldNo && subjectLeId && entityId) {
        const derived = await KycStateService.getAuthoritativeValue(
            { subjectLeId },
            question.masterFieldNo,
            ownerScopeId || undefined,
            snapshotDate
        );

        if (derived && derived.value !== null && derived.value !== undefined && derived.value !== "") {
            const displayValue = await formatExportValue(derived.value);
            
            // Resolve provenance
            let sourceLabel = derived.sourceType;
            let sourceUserName: string | null = null;
            let sourceTimestamp = derived.assertedAt;

            let sourceCategory: 'REGISTRY' | 'USER' | 'DEFAULT' | 'SYSTEM' = 'REGISTRY';
            if (derived.sourceType === 'USER_INPUT') {
                const claim = await prisma.fieldClaim.findUnique({
                    where: { id: derived.claimId },
                    include: { verifiedBy: true }
                });
                sourceUserName = claim?.verifiedBy?.name || claim?.verifiedBy?.email || null;
                sourceLabel = sourceUserName ? `User input — ${sourceUserName}` : "User input";
                sourceCategory = 'USER';
            } else if (derived.sourceReference === 'COMPANIES_HOUSE' || derived.sourceType === 'COMPANIES_HOUSE') {
                sourceCategory = 'REGISTRY';
            } else if (derived.sourceType === 'GLEIF') {
                sourceCategory = 'REGISTRY';
            } else if (derived.sourceType === 'REGISTRATION_AUTHORITY' || derived.sourceType === 'NATIONAL_REGISTRY') {
                sourceCategory = 'REGISTRY';
            } else if (derived.sourceType === 'SYSTEM_DERIVED' || derived.sourceType === 'AI_EXTRACTION') {
                sourceCategory = 'SYSTEM';
            } else {
                sourceCategory = 'SYSTEM';
            }

            // Apply human-readable naming conventions centrally
            sourceLabel = getSourceDisplayName(derived.sourceType, derived.sourceReference);
            if (derived.sourceType === 'USER_INPUT' && sourceUserName) {
                sourceLabel = `User input — ${sourceUserName}`;
            }

            return {
                displayValue,
                rawValue: derived.value,
                answerState: derived.value.explicitNone === true ? "EMPTY_CHECKED" : "HAS_VALUE",
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

            const displayValue = await formatExportValue(parsedAnswer);
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
