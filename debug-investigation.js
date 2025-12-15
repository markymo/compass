
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigate() {
    const latest = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' } });
    if (!latest) return console.log("No schema");

    const def = latest.definition;
    const categories = def.categories || [];

    console.log("--- Category 2 (UBO) ---");
    const uboCat = categories.find(c => c.id === "2");
    if (uboCat) {
        console.log("Title:", uboCat.title);
        console.log("Examples in DB:", JSON.stringify(uboCat.examples));
    } else {
        console.log("Category 2 not found");
    }

    console.log("\n--- Field: ultimate_beneficiary ---");
    const field = def.fields.find(f => f.key === "ultimate_beneficiary" || f.label.includes("Ultimate"));
    if (field) {
        console.log("Found field:", field.label, field.key);
        console.log("Current Proposal:", field.proposedCategoryId);
    } else {
        console.log("Field not found in schema");
    }

}

investigate()
    .finally(() => prisma.$disconnect());
