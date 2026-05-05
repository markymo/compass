import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.membership.findMany();
  let errors = 0;
  
  const orgMap = new Set();
  const leMap = new Set();
  const engMap = new Set();

  for (const m of memberships) {
    let scopes = 0;
    if (m.organizationId) scopes++;
    if (m.clientLEId) scopes++;
    if (m.fiEngagementId) scopes++;

    if (scopes === 0) {
      console.error(`Violation: Membership ${m.id} has NO scope.`);
      errors++;
    }
    if (scopes > 1) {
      console.error(`Violation: Membership ${m.id} has MULTIPLE scopes.`);
      errors++;
    }

    if (m.organizationId && !m.clientLEId && !m.fiEngagementId) {
      const key = `${m.userId}-${m.organizationId}`;
      if (orgMap.has(key)) {
        console.error(`Violation: Duplicate org membership for user ${m.userId} in org ${m.organizationId}`);
        errors++;
      }
      orgMap.add(key);
    }
    if (m.clientLEId && !m.organizationId && !m.fiEngagementId) {
      const key = `${m.userId}-${m.clientLEId}`;
      if (leMap.has(key)) {
        console.error(`Violation: Duplicate LE membership for user ${m.userId} in LE ${m.clientLEId}`);
        errors++;
      }
      leMap.add(key);
    }
    if (m.fiEngagementId && !m.organizationId && !m.clientLEId) {
      const key = `${m.userId}-${m.fiEngagementId}`;
      if (engMap.has(key)) {
        console.error(`Violation: Duplicate Eng membership for user ${m.userId} in Eng ${m.fiEngagementId}`);
        errors++;
      }
      engMap.add(key);
    }
  }

  if (errors > 0) {
    console.log(`Found ${errors} violations. Stopping.`);
    process.exit(1);
  } else {
    console.log("No violations found. Clean to proceed.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
