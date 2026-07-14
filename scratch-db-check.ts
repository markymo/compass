import prisma from "./src/lib/prisma";

async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany({ where: { sourceType: 'GLEIF' } });
  
  const bySubtype: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const l2AndElfPaths: string[] = [];
  
  for (const m of mappings) {
    const subtypeStr = m.payloadSubtype === null ? "null" : m.payloadSubtype;
    bySubtype[subtypeStr] = (bySubtype[subtypeStr] || 0) + 1;
    
    byScope[m.mappingScope] = (byScope[m.mappingScope] || 0) + 1;
    
    if (m.sourcePath.startsWith("gleifL2") || m.sourcePath.startsWith("gleifElf") || m.payloadSubtype === "LEVEL_2_RELATIONSHIPS" || m.payloadSubtype === "ELF") {
      l2AndElfPaths.push(`path=${m.sourcePath} | subtype=${m.payloadSubtype} | scope=${m.mappingScope}`);
    }
  }
  
  console.log("By Subtype:", bySubtype);
  console.log("By Scope:", byScope);
  console.log("L2/ELF Mappings:\n", l2AndElfPaths.join("\n"));
}

run();
