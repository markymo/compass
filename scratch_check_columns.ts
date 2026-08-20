import prisma from "./src/lib/prisma";

async function main() {
    console.log("=== CHECKING FIELD_CLAIMS COLUMNS IN DATABASE ===");
    const columns: any[] = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'field_claims'
        ORDER BY column_name;
    `;
    console.log("Database columns on field_claims:");
    console.log(columns);
}

main().catch(console.error).finally(() => prisma.$disconnect());
