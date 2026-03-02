
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
    try {
        const rawTables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const dbTables = rawTables.map(t => t.table_name);

        const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf-8');

        // Simple regex to get model and enum names
        const prismaModels = [...schemaContent.matchAll(/model\s+(\w+)\s+\{/g)].map(m => m[1]);
        const prismaEnums = [...schemaContent.matchAll(/enum\s+(\w+)\s+\{/g)].map(m => m[1]);

        // Check for @@map
        const mappedModels = [...schemaContent.matchAll(/model\s+(\w+)\s+\{(?:[^{}]|model)*?@@map\(\"(.+?)\"\)/gs)].map(m => ({ prisma: m[1], db: m[2] }));

        const effectivePrismaNames = prismaModels.map(m => {
            const found = mappedModels.find(mm => mm.prisma === m);
            return found ? found.db : m;
        });

        const legacyTables = dbTables.filter(t => !effectivePrismaNames.includes(t) && t !== '_prisma_migrations');

        console.log('Database Tables:', dbTables.length);
        console.log('Prisma Models:', prismaModels.length);

        if (legacyTables.length > 0) {
            console.log('\n⚠️ Legacy Tables in DB (not in Prisma):');
            legacyTables.forEach(t => console.log(' - ' + t));
        } else {
            console.log('\n✅ No undocumented tables found.');
        }

        // Enums
        const rawEnums = await prisma.$queryRawUnsafe("SELECT DISTINCT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'");
        const dbEnums = rawEnums.map(e => e.typname);
        const legacyEnums = dbEnums.filter(e => !prismaEnums.includes(e));
        if (legacyEnums.length > 0) {
            console.log('\n⚠️ Legacy Enums in DB (not in Prisma):');
            legacyEnums.forEach(e => console.log(' - ' + e));
        }

    } catch (e) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}
run();
