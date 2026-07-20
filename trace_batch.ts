import { PrismaClient } from '@prisma/client';
import { resolveMasterDataBatch } from './src/actions/kyc-query';
import { getMasterFieldGroup, getMasterFieldDefinition } from './src/services/masterData/definitionService';
const prisma = new PrismaClient();

async function run() {
  const clientLeId = "55cf4edc-d078-4313-b467-93e7fd07acd1";
  const subjectLeId = "285f5647-a122-469c-b916-274226f4b586";
  const fieldNos = [138];
  
  const claims = await prisma.fieldClaim.findMany({
      where: { subjectLeId, fieldNo: { in: fieldNos }, claimRole: 'VALUE', status: { in: ['VERIFIED', 'ASSERTED'] } },
      orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
  });
  
  const sourceMappings = await prisma.sourceFieldMapping.findMany({
      where: { targetFieldNo: { in: fieldNos }, isActive: true }
  });

  const fieldDefMap = new Map();
  const def = await getMasterFieldDefinition(138);
  fieldDefMap.set(138, { fieldNo: def.fieldNo, fieldName: def.fieldName, appDataType: def.appDataType, isMultiValue: def.isMultiValue, profileConfig: def.profileConfig });

  const groupFieldMap = new Map();
  groupFieldMap.set("fake-group", fieldNos);

  const batchInput = {
      subjectLeId,
      ownerScopeId: null,
      questions: [{ questionId: "q1", masterQuestionGroupId: "fake-group", masterFieldProjectionPath: null }],
      fieldDefMap,
      groupFieldMap,
      claims: claims as any,
      sourceMappings,
      attachmentsByField: new Map(),
      provenanceMap: null,
  };

  const resolvedValues = await resolveMasterDataBatch(batchInput);
  console.log("Resolved batch:", JSON.stringify(resolvedValues, null, 2));
}

run().finally(() => prisma.$disconnect());
