import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, 'seed_registry_authorities.sql');
  console.log(`Reading SQL file from: ${sqlPath}`);
  
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found at ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Executing SQL script (${sql.length} characters)...`);

  // Run the SQL script
  const result = await prisma.$executeRawUnsafe(sql);
  console.log(`SQL execution complete. Result code: ${result}`);
}

main()
  .catch((e) => {
    console.error('❌ Error executing SQL script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
