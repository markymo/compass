
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkState() {
    const latest = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' } });
    if (!latest) return console.log("No schema");

    const def = latest.definition;
    const categories = def.categories || [];

    console.log("Category Count:", categories.length);
    if (categories.length > 0) {
        console.log("Sample Category 1:", JSON.stringify(categories[0], null, 2));
        console.log("Has Examples?", !!categories[0].examples);
        console.log("Example Count:", categories[0].examples?.length);
    }

    const fields = def.fields || [];
    console.log("Total Fields:", fields.length);

    const activeProposals = fields.filter(f => f.proposedCategoryId);
    console.log("Fields with Proposals:", activeProposals.length);
    if (activeProposals.length > 0) {
        console.log("Sample Proposal:", activeProposals[0].label, "->", activeProposals[0].proposedCategoryId);
    }
}

checkState()
    .finally(() => prisma.$disconnect());
