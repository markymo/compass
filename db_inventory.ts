import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const tables = [
        'Account', 'Session', 'VerificationToken', 'User', 'Organization', 'Membership',
        'MasterSchema', 'FISchema', 'CustomFieldDefinition', 'StandingDataSection',
        'ClientLE', 'ClientLEOwner', 'ClientLERecord', 'FIEngagement', 'EngagementActivity',
        'Document', 'Query', 'Questionnaire', 'Question', 'Comment', 'QuestionActivity',
        'MasterFieldAssignment', 'MasterFieldNote', 'QuestionnaireVersion', 'UsageLog',
        'SystemSetting', 'AdminTodo', 'AdminTodoComment', 'Invitation', 'LEActivity',
        'LegalEntity', 'EvidenceStore', 'DocumentRegistry', 'FeedbackNote', 'Address',
        'Person', 'FieldClaim', 'MasterFieldDefinition', 'MasterFieldGraphBinding',
        'MasterDataOptionSet', 'MasterDataCategory', 'MasterFieldGroup', 'MasterFieldGroupItem',
        'SourceFieldMapping', 'SourceSamplePayload', 'RegistryAuthority', 'RegistryReference',
        'RegistryFetch', 'EnrichmentRun', 'RegistrySourcePayload', 'RegistryBaselineExtract',
        'ClientLEGraphNode', 'ClientLEGraphEdge', 'QuestionnaireVisibilityGrant', 'AuditLog',
        'AdminMomentumObservation', 'CCParty', 'CCAddress'
    ];

    console.log("--- Table Row Counts ---");
    for (const table of tables) {
        try {
            // @ts-ignore
            const count = await prisma[table.charAt(0).toLowerCase() + table.slice(1)].count();
            console.log(`${table}: ${count}`);
        } catch (e: any) {
            // try exact casing for some like cCParty
            try {
                // @ts-ignore
                const count = await prisma[table].count();
                console.log(`${table}: ${count}`);
            } catch (e2: any) {
                console.log(`${table}: ERROR ${e2.message.split('\n')[0]}`);
            }
        }
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
