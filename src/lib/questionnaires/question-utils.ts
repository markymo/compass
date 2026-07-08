export function cloneQuestionFields(q: any, targetQuestionnaireId: string, overrides: any = {}) {
    return {
        questionnaireId: targetQuestionnaireId,
        text: q.text,
        compactText: q.compactText,
        order: q.order,
        // Mapping Fields
        masterFieldNo: q.masterFieldNo,
        masterQuestionGroupId: q.masterQuestionGroupId,
        customFieldDefinitionId: q.customFieldDefinitionId,
        masterFieldProjectionPath: q.masterFieldProjectionPath,
        approvedMappingConfig: q.approvedMappingConfig ? JSON.parse(JSON.stringify(q.approvedMappingConfig)) : null,
        // Other cloned fields
        sourceSectionId: q.sourceSectionId,
        expectedDataType: q.expectedDataType,
        allowAttachments: q.allowAttachments,
        prefilledValue: q.prefilledValue,
        status: "DRAFT" as any,
        ...overrides
    };
}
