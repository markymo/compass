import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Replicate exactly what ai-mapper.ts does to build schemaContext
    const groups = await prisma.masterFieldGroup.findMany({
        where: { isActive: true },
        include: {
            items: {
                where: { field: { isActive: true } },
                select: { fieldNo: true },
                orderBy: { order: 'asc' }
            }
        },
        orderBy: { order: 'asc' }
    });

    const groupsWithFieldNos = groups.map((g: any) => ({
        ...g,
        fieldNos: g.items.map((i: any) => i.fieldNo)
    }));

    const fields = await prisma.masterFieldDefinition.findMany({
        where: { isActive: true },
        include: { masterDataCategory: true }
    });

    let schemaContext = "";

    if (groupsWithFieldNos.length > 0) {
        schemaContext += "MASTER FIELD GROUPS (Composite - Prefer these):\n";
        schemaContext += groupsWithFieldNos.map((g: any) =>
            `- GroupKey: "${g.key}" Label: "${g.label}" (Fields: ${g.fieldNos.join(',')})`
        ).join('\n');
        schemaContext += "\n\n";
    }

    if (fields.length > 0) {
        schemaContext += "MASTER ATOMIC FIELDS:\n";
        schemaContext += fields.map((f: any) =>
            `- Field ${f.fieldNo} (Key: "${f.fieldNo}"): ${f.fieldName} (${f.appDataType}) - ${f.notes || ''}`
        ).join('\n');
        schemaContext += "\n\n";
    }

    const STANDARD_CATEGORIES = ["Core Details", "Corporate Structure", "Geography", "Products & Services", "Compliance & Regulation"];
    schemaContext += `STANDARD CATEGORIES:\n${STANDARD_CATEGORIES.join(', ')}\n`;

    const fullPrompt = `Extract all structural elements (Questions, Sections, Instructions, Notes) from the provided document content.
            
CRITICAL MAPPING RULES:
1. Assign 'category' from the Standard List provided.
2. Try to map each Question to a Master Field or Group.
3. PREFER 'masterQuestionGroupId' for composite concepts (Address, Person, UBO).
4. Use 'masterKey' (Field No) only for atomic fields (Name, Date, Status).
5. ESTIMATE 'confidence' (0.0 to 1.0) based on semantic similarity of the text to the Master Field label.
6. If NO Master Field matches (Confidence < 0.5), PROPOSE a 'newFieldProposal' with a clear Label and Type.
7. For questions, ALWAYS extract the core concept into a 'compactText' label strictly under 20 characters (e.g. "German TIN", NOT "Confirm if..."). Do not just truncate.

CONTEXT:
${schemaContext}`;

    console.log("=== GROUPS COUNT:", groupsWithFieldNos.length);
    console.log("=== FIELDS COUNT:", fields.length);
    console.log("\n=== FULL PROMPT TEXT SENT TO GPT-4o ===\n");
    console.log(fullPrompt);
    console.log("\n=== RAW GROUPS (for reference) ===");
    groupsWithFieldNos.forEach((g: any) => {
        console.log(`  [${g.key}] ${g.label} — fields: [${g.fieldNos.join(', ')}]`);
    });
    console.log("\n=== RAW FIELDS (for reference) ===");
    fields.sort((a: any, b: any) => a.fieldNo - b.fieldNo).forEach((f: any) => {
        console.log(`  Field ${f.fieldNo}: ${f.fieldName} (${f.appDataType}) notes="${f.notes || ''}"`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
