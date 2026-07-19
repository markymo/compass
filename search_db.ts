import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'varchar', 'jsonb', 'json')
  `);

  const matches = [];
  for (const row of result as any[]) {
    try {
      const table = row.table_name;
      const col = row.column_name;
      const q = \`SELECT count(*) FROM "\${table}" WHERE CAST("\${col}" AS TEXT) LIKE '%984500BFCB566D38DU72%'\`;
      const match = await prisma.$queryRawUnsafe(q);
      if (Number(match[0].count) > 0) {
        matches.push({ table, col, count: Number(match[0].count) });
      }
    } catch (e) {
      // ignore
    }
  }
  console.log('Matches:', matches);
}

main().catch(console.error).finally(() => prisma.$disconnect());
