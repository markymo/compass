import prisma from "./src/lib/prisma";
async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany({ where: { sourceType: 'GLEIF' } });
  const byScope = { BASELINE: 0, RAW_PAYLOAD: 0, OTHER: 0 };
  const bySubtype = { LEVEL_1: 0, LEVEL_2_RELATIONSHIPS: 0, ELF: 0, GENERAL: 0, NULL: 0, OTHER: 0 };
  for (const m of mappings) {
    if (m.mappingScope === 'BASELINE') byScope.BASELINE++;
    else if (m.mappingScope === 'RAW_PAYLOAD') byScope.RAW_PAYLOAD++;
    else byScope.OTHER++;
    
    if (m.payloadSubtype === 'LEVEL_1') bySubtype.LEVEL_1++;
    else if (m.payloadSubtype === 'LEVEL_2_RELATIONSHIPS') bySubtype.LEVEL_2_RELATIONSHIPS++;
    else if (m.payloadSubtype === 'ELF') bySubtype.ELF++;
    else if (m.payloadSubtype === 'GENERAL') bySubtype.GENERAL++;
    else if (m.payloadSubtype === null) bySubtype.NULL++;
    else bySubtype.OTHER++;
  }
  console.log("By Scope:", byScope);
  console.log("By Subtype:", bySubtype);
}
run();
