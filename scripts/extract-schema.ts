import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log("Fetching Master Schema fields from Production...");
  const fields = await prisma.masterFieldDefinition.findMany({
    include: {
      sourceMappings: true
    },
    orderBy: {
      fieldNo: 'asc'
    }
  })

  let csvContent = `"Field No","Field name","Description / Help Text","Data Type","Entity Scope / Domain","Mandatory / Optional","Source Mappings"\n`;

  for (const field of fields) {
    const fieldNo = field.fieldNo;
    const fieldName = escapeCSV(field.fieldName || '');
    const description = escapeCSV(field.description || field.notes || '');
    const dataType = escapeCSV(field.appDataType || '');
    const scope = escapeCSV((field.domain || []).join(', '));
    
    // Schema definition lacks 'isMandatory' flag on MasterFieldDefinition
    // Setting default to 'Optional' unless specified in notes
    const isMandatory = 'Optional'; 
    const mappings = escapeCSV(field.sourceMappings.map(m => `${m.sourceType}:${m.sourcePath}`).join(' | '));

    csvContent += `"${fieldNo}","${fieldName}","${description}","${dataType}","${scope}","${isMandatory}","${mappings}"\n`;
  }

  const outputPath = path.join(process.cwd(), 'Master_Schema_Production_Extract.csv');
  fs.writeFileSync(outputPath, csvContent);
  console.log(`Extraction complete. File saved to ${outputPath}`);
}

function escapeCSV(str: string | null | undefined) {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/"/g, '""'); // Escape inner quotes
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
