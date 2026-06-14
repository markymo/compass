import { describe, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-test-123' }),
}));

import { getFieldDetail } from '../kyc-query';
import { getFullMasterData } from '../client-le';

const prisma = new PrismaClient();

import { isPersonOrContactValue } from '@/lib/master-data/person-or-contact-value';

describe('inspect valueJson types in query lifecycles', () => {
  it('logs and prints data types', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('[Diagnostic] Skipping diagnostic test: DATABASE_URL environment variable is missing.');
      return;
    }
    const claims = await prisma.fieldClaim.findMany({
      where: { fieldNo: 63 },
    });
    console.log(`[Diagnostic] Total database claims: ${claims.length}`);
    for (const c of claims) {
      console.log(`[Diagnostic] Claim ID: ${c.id}`);
      console.log(` - collectionId: ${c.collectionId}`);
      console.log(` - instanceId: ${c.instanceId}`);
      console.log(` - status: ${c.status}`);
    }
  });
});
