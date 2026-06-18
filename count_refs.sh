#!/bin/bash
tables=(
"Account" "Session" "VerificationToken" "User" "Organization" "Membership"
"MasterSchema" "FISchema" "CustomFieldDefinition" "StandingDataSection"
"ClientLE" "ClientLEOwner" "ClientLERecord" "FIEngagement" "EngagementActivity"
"Document" "Query" "Questionnaire" "Question" "Comment" "QuestionActivity"
"MasterFieldAssignment" "MasterFieldNote" "QuestionnaireVersion" "UsageLog"
"SystemSetting" "AdminTodo" "AdminTodoComment" "Invitation" "LEActivity"
"LegalEntity" "EvidenceStore" "DocumentRegistry" "FeedbackNote" "Address"
"Person" "FieldClaim" "MasterFieldDefinition" "MasterFieldGraphBinding"
"MasterDataOptionSet" "MasterDataCategory" "MasterFieldGroup" "MasterFieldGroupItem"
"SourceFieldMapping" "SourceSamplePayload" "RegistryAuthority" "RegistryReference"
"RegistryFetch" "EnrichmentRun" "RegistrySourcePayload" "RegistryBaselineExtract"
"ClientLEGraphNode" "ClientLEGraphEdge" "QuestionnaireVisibilityGrant" "AuditLog"
"AdminMomentumObservation" "CCParty" "CCAddress"
)

echo "--- Table Code Reference Counts ---"
for t in "${tables[@]}"; do
    lower_t="$(tr '[:upper:]' '[:lower:]' <<< ${t:0:1})${t:1}"
    count=$(grep -r -I "prisma.$lower_t\." src | wc -l)
    if [ "$count" -eq 0 ]; then
        # Try exact case for some edge cases
        count=$(grep -r -I "prisma.$t\." src | wc -l)
    fi
    echo "$t: $count"
done
