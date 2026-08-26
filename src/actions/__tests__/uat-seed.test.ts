import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { seedUAT } from '../../../scripts/uat-seed';
import * as fs from 'fs';

describe('Deterministic Synthetic UAT Seed & Environment Guards', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.UAT_SEED_ALLOWED;
        delete process.env.UAT_PASSWORD;
        delete process.env.NEXT_PUBLIC_APP_ENV;
        delete process.env.APP_ENV;
        delete process.env.VERCEL_ENV;
        delete process.env.PLAYWRIGHT_BASE_URL;
        delete process.env.UAT_ALLOWED_DATABASE_HOST;
        delete process.env.UAT_ALLOWED_DATABASE_NAME;
        delete process.env.DATABASE_URL;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // ── 1. Refusal Guards ───────────────────────────────────────────────────
    describe('1. Environment Safety & Database Allow-List Refusal Guards', () => {
        it('refuses to run when UAT_SEED_ALLOWED is not true', async () => {
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing to seed UAT: UAT_SEED_ALLOWED=true environment variable is required.'
            );
        });

        it('refuses to run when UAT_PASSWORD is missing or empty', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.APP_ENV = 'staging';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing to seed UAT: UAT_PASSWORD environment variable is required and must not be empty.'
            );

            process.env.UAT_PASSWORD = '   ';
            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing to seed UAT: UAT_PASSWORD environment variable is required and must not be empty.'
            );
        });

        it('refuses to run when target host is bare production onpro.tech', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.PLAYWRIGHT_BASE_URL = 'https://onpro.tech';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing to seed UAT: Production onpro.tech host detected.'
            );
        });

        // ── Test A: correct APP_ENV, wrong database host ───────────────────────
        it('Test A: refuses when APP_ENV is staging but database host does not match allowlist', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@wrong.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing UAT seed: database target is not the approved UAT/development database.'
            );
        });

        // ── Test B: correct host, wrong database name ──────────────────────────
        it('Test B: refuses when host matches but database name does not match allowlist', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/wrongdb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing UAT seed: database target is not the approved UAT/development database.'
            );
        });

        // ── Test C: missing UAT_ALLOWED_DATABASE_HOST ───────────────────────────
        it('Test C: refuses when UAT_ALLOWED_DATABASE_HOST is missing', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            delete process.env.UAT_ALLOWED_DATABASE_HOST;
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing UAT seed: database target is not the approved UAT/development database.'
            );
        });

        // ── Test D: missing UAT_ALLOWED_DATABASE_NAME ───────────────────────────
        it('Test D: refuses when UAT_ALLOWED_DATABASE_NAME is missing', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            delete process.env.UAT_ALLOWED_DATABASE_NAME;
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing UAT seed: database target is not the approved UAT/development database.'
            );
        });

        // ── Test E: correct DB target but APP_ENV=production ────────────────────
        it('Test E: refuses when DB target matches but APP_ENV is explicitly production', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'production';
            process.env.NODE_ENV = 'production';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            await expect(seedUAT({} as any)).rejects.toThrow(
                'Refusing to seed UAT: Target environment is not a recognized non-production or staging environment.'
            );
        });
    });

    // ── 2. Seed Execution & Invariant Verification (Test F) ─────────────────
    describe('2. In-Memory Mock Seed Execution & Invariant Verification', () => {
        it('Test F: permits execution when all required conditions are satisfied, sets null LEI/GLEIF, and generates clean manifest', async () => {
            process.env.UAT_SEED_ALLOWED = 'true';
            process.env.UAT_PASSWORD = 'TestPassword123!';
            process.env.APP_ENV = 'staging';
            process.env.PLAYWRIGHT_BASE_URL = 'https://dev.onpro.tech';
            process.env.UAT_ALLOWED_DATABASE_HOST = 'approved.example.test';
            process.env.UAT_ALLOWED_DATABASE_NAME = 'neondb';
            process.env.DATABASE_URL = 'postgresql://user:pass@approved.example.test/neondb';

            const mockOrgStore: any[] = [
                { id: 'sys-org-id', name: 'Compass System', shortCode: 'system_platform', types: ['SYSTEM'] }
            ];
            const mockLEStore: any[] = [];
            const mockOwnerStore: any[] = [];
            const mockClaimStore: any[] = [];
            const mockEngStore: any[] = [];
            const mockUserStore: any[] = [];
            const mockMembershipStore: any[] = [];

            const mockPrisma: any = {
                organization: {
                    findFirst: vi.fn(async ({ where }: any) => {
                        return mockOrgStore.find((o) => (where.types?.has ? o.types.includes(where.types.has) : true)) || null;
                    }),
                    upsert: vi.fn(async ({ where, create, update }: any) => {
                        let existing = mockOrgStore.find((o) => o.shortCode === where.shortCode);
                        if (!existing) {
                            existing = { id: `org-${where.shortCode}`, ...create };
                            mockOrgStore.push(existing);
                        } else {
                            Object.assign(existing, update);
                        }
                        return existing;
                    })
                },
                clientLE: {
                    upsert: vi.fn(async ({ where, create, update }: any) => {
                        let existing = mockLEStore.find((l) => l.shortCode === where.shortCode);
                        if (!existing) {
                            existing = { id: `cle-${where.shortCode}`, ...create };
                            mockLEStore.push(existing);
                        } else {
                            Object.assign(existing, update);
                        }
                        return existing;
                    })
                },
                clientLEOwner: {
                    findFirst: vi.fn(async ({ where }: any) => {
                        return mockOwnerStore.find((o) => o.clientLEId === where.clientLEId && o.partyId === where.partyId && o.endAt === where.endAt) || null;
                    }),
                    create: vi.fn(async ({ data }: any) => {
                        const rec = { id: `owner-${mockOwnerStore.length + 1}`, ...data };
                        mockOwnerStore.push(rec);
                        return rec;
                    })
                },
                fieldClaim: {
                    findFirst: vi.fn(async ({ where }: any) => {
                        return mockClaimStore.find((c) => c.clientLEId === where.clientLEId && c.fieldNo === where.fieldNo) || null;
                    }),
                    create: vi.fn(async ({ data }: any) => {
                        const rec = { id: `claim-${mockClaimStore.length + 1}`, ...data };
                        mockClaimStore.push(rec);
                        return rec;
                    }),
                    update: vi.fn(async ({ where, data }: any) => {
                        const existing = mockClaimStore.find((c) => c.id === where.id);
                        if (existing) Object.assign(existing, data);
                        return existing;
                    })
                },
                fIEngagement: {
                    upsert: vi.fn(async ({ where, create, update }: any) => {
                        let existing = mockEngStore.find(
                            (e) => e.fiOrgId === where.fiOrgId_clientLEId.fiOrgId && e.clientLEId === where.fiOrgId_clientLEId.clientLEId
                        );
                        if (!existing) {
                            existing = { id: `eng-${mockEngStore.length + 1}`, ...create };
                            mockEngStore.push(existing);
                        } else {
                            Object.assign(existing, update);
                        }
                        return existing;
                    })
                },
                user: {
                    upsert: vi.fn(async ({ where, create, update }: any) => {
                        let existing = mockUserStore.find((u) => u.email === where.email);
                        if (!existing) {
                            existing = { id: `user-${where.email}`, ...create };
                            mockUserStore.push(existing);
                        } else {
                            Object.assign(existing, update);
                        }
                        return existing;
                    }),
                    findMany: vi.fn(async ({ where }: any) => {
                        return mockUserStore
                            .filter((u) => u.email.startsWith('uat+'))
                            .map((u) => ({
                                ...u,
                                memberships: mockMembershipStore.filter((m) => m.userId === u.id)
                            }));
                    })
                },
                membership: {
                    deleteMany: vi.fn(async ({ where }: any) => {
                        const before = mockMembershipStore.length;
                        for (let i = mockMembershipStore.length - 1; i >= 0; i--) {
                            if (mockMembershipStore[i].userId === where.userId) {
                                mockMembershipStore.splice(i, 1);
                            }
                        }
                        return { count: before - mockMembershipStore.length };
                    }),
                    create: vi.fn(async ({ data }: any) => {
                        const rec = { id: `mem-${mockMembershipStore.length + 1}`, ...data };
                        mockMembershipStore.push(rec);
                        return rec;
                    })
                }
            };

            const result = await seedUAT(mockPrisma);

            expect(result.success).toBe(true);
            expect(result.counts.clientLEs).toBe(2);
            expect(result.counts.users).toBe(9);
            expect(result.counts.memberships).toBe(9);
            expect(result.verification.alphaDisplayName).toBe('UAT Alpha Limited');
            expect(result.verification.betaDisplayName).toBe('UAT Beta Limited');
            expect(result.verification.alphaLeiNull).toBe(true);
            expect(result.verification.betaLeiNull).toBe(true);
            expect(result.verification.membershipIsolationPassed).toBe(true);

            // Verify manifest was created and contains no secrets
            const manifestRaw = fs.readFileSync(result.manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestRaw);

            expect(manifest).toHaveProperty('clientOrgA');
            expect(manifest).toHaveProperty('alphaClientLE');
            expect(manifest).toHaveProperty('actors');
            expect(manifestRaw).not.toContain('password');
            expect(manifestRaw).not.toContain('TestPassword123!');
            expect(manifestRaw).not.toContain('$2a$');
            expect(manifestRaw).not.toContain('$2b$');
        });
    });
});
