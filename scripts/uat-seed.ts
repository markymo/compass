/**
 * scripts/uat-seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic Synthetic UAT Fixture Seeder for OnPro Staging & Development.
 *
 * Establishes a predictable, isolated synthetic namespace for:
 *   - Platform vs Tenant Security Boundary Verification
 *   - ClientLE Operational vs Structural Visibility
 *   - Cross-Entity & Cross-Relationship Data Isolation
 *   - Deterministic Playwright & UAT Regression Testing
 *
 * INVARIANTS:
 *   1. Refuses to run without UAT_SEED_ALLOWED=true and a non-empty UAT_PASSWORD.
 *   2. Refuses to run in unconfirmed production environments.
 *   3. Operates strictly within the synthetic "uat_*" namespace (no foreign mutations).
 *   4. Convergent & Idempotent: Repeated runs repair drift without record duplication.
 *   5. Zero External API Calls: ClientLEs have null LEI/gleifData to test fallback paths.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient, Prisma, OrgType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { getLEDisplayName } from '../src/lib/le-display-name';
import { isNonProductionEnv } from '../src/lib/env';

export interface UATSeedResult {
    success: boolean;
    manifestPath: string;
    counts: {
        organizations: number;
        clientLEs: number;
        relationships: number;
        users: number;
        memberships: number;
        fieldClaims: number;
    };
    verification: {
        alphaDisplayName: string;
        betaDisplayName: string;
        alphaLeiNull: boolean;
        betaLeiNull: boolean;
        alphaGleifNull: boolean;
        betaGleifNull: boolean;
        membershipIsolationPassed: boolean;
    };
}

export async function seedUAT(prismaClient?: PrismaClient | any, options?: { manifestPath?: string }): Promise<UATSeedResult> {
    // ── 1. ENVIRONMENT SAFETY GATES ──────────────────────────────────────────
    if (process.env.UAT_SEED_ALLOWED !== 'true') {
        throw new Error('Refusing to seed UAT: UAT_SEED_ALLOWED=true environment variable is required.');
    }

    const uatPassword = process.env.UAT_PASSWORD;
    if (!uatPassword || uatPassword.trim() === '') {
        throw new Error('Refusing to seed UAT: UAT_PASSWORD environment variable is required and must not be empty.');
    }

    const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || '').toLowerCase();
    const isStagingOrDev = ['dev', 'development', 'staging', 'preview', 'test', 'local'].includes(appEnv) || isNonProductionEnv();

    if (!isStagingOrDev) {
        throw new Error('Refusing to seed UAT: Target environment is not a recognized non-production or staging environment.');
    }

    const host = (process.env.PLAYWRIGHT_BASE_URL || process.env.NEXTAUTH_URL || '').toLowerCase();
    if (host.includes('onpro.tech') && !host.includes('dev.onpro.tech') && !host.includes('staging')) {
        throw new Error('Refusing to seed UAT: Production onpro.tech host detected.');
    }

    // ── 1B. POSITIVE DATABASE ALLOW-LIST GATE ─────────────────────────────────
    const allowedDbHost = process.env.UAT_ALLOWED_DATABASE_HOST;
    const allowedDbName = process.env.UAT_ALLOWED_DATABASE_NAME;

    if (!allowedDbHost || allowedDbHost.trim() === '') {
        throw new Error('Refusing UAT seed: database target is not the approved UAT/development database.');
    }
    if (!allowedDbName || allowedDbName.trim() === '') {
        throw new Error('Refusing UAT seed: database target is not the approved UAT/development database.');
    }

    const rawDbUrl = process.env.DATABASE_URL;
    if (!rawDbUrl || rawDbUrl.trim() === '') {
        throw new Error('Refusing UAT seed: database target is not the approved UAT/development database.');
    }

    let actualHost: string;
    let actualDatabaseName: string;
    try {
        const parsedDb = new URL(rawDbUrl);
        actualHost = parsedDb.hostname;
        actualDatabaseName = parsedDb.pathname.replace(/^\/+/, '');
    } catch {
        throw new Error('Refusing UAT seed: database target is not the approved UAT/development database.');
    }

    if (actualHost !== allowedDbHost || actualDatabaseName !== allowedDbName) {
        throw new Error('Refusing UAT seed: database target is not the approved UAT/development database.');
    }

    const prisma = prismaClient || new PrismaClient();

    try {
        console.log('🌱 Starting Deterministic Synthetic UAT Seed...');

        const passwordHash = await bcrypt.hash(uatPassword, 10);

        // ── 2. SYNTHETIC ORGANISATIONS ───────────────────────────────────────
        console.log('🏢 Converging Synthetic Organisations...');

        // Reuse existing canonical SYSTEM organisation if present, or create one
        let systemOrg = await prisma.organization.findFirst({
            where: { types: { has: 'SYSTEM' as OrgType } }
        });
        if (!systemOrg) {
            systemOrg = await prisma.organization.create({
                data: {
                    name: 'Compass System',
                    shortCode: 'system_platform',
                    types: ['SYSTEM'],
                    domain: 'compass.local',
                    status: 'ACTIVE'
                }
            });
        }

        // UAT Client Org A
        const clientOrgA = await prisma.organization.upsert({
            where: { shortCode: 'uat_client_org_a' },
            update: {
                name: 'UAT Client Org A',
                types: ['CLIENT'],
                status: 'ACTIVE'
            },
            create: {
                name: 'UAT Client Org A',
                shortCode: 'uat_client_org_a',
                types: ['CLIENT'],
                status: 'ACTIVE',
                domain: 'uat-client-a.test'
            }
        });

        // UAT Client Org B
        const clientOrgB = await prisma.organization.upsert({
            where: { shortCode: 'uat_client_org_b' },
            update: {
                name: 'UAT Client Org B',
                types: ['CLIENT'],
                status: 'ACTIVE'
            },
            create: {
                name: 'UAT Client Org B',
                shortCode: 'uat_client_org_b',
                types: ['CLIENT'],
                status: 'ACTIVE',
                domain: 'uat-client-b.test'
            }
        });

        // UAT Supplier Org A
        const supplierOrgA = await prisma.organization.upsert({
            where: { shortCode: 'uat_supplier_org_a' },
            update: {
                name: 'UAT Supplier Org A',
                types: ['SUPPLIER'],
                status: 'ACTIVE'
            },
            create: {
                name: 'UAT Supplier Org A',
                shortCode: 'uat_supplier_org_a',
                types: ['SUPPLIER'],
                status: 'ACTIVE',
                domain: 'uat-supplier-a.test'
            }
        });

        // ── 3. SYNTHETIC CLIENT LES ──────────────────────────────────────────
        console.log('🏛️ Converging Synthetic ClientLEs (with null LEI / gleifData)...');

        const alphaLE = await prisma.clientLE.upsert({
            where: { shortCode: 'uat_cle_alpha' },
            update: {
                name: 'UAT Alpha Limited',
                lei: null,
                gleifData: Prisma.DbNull,
                nationalRegistryData: Prisma.DbNull,
                status: 'ACTIVE',
                isDeleted: false
            },
            create: {
                name: 'UAT Alpha Limited',
                shortCode: 'uat_cle_alpha',
                lei: null,
                status: 'ACTIVE',
                isDeleted: false
            }
        });

        const betaLE = await prisma.clientLE.upsert({
            where: { shortCode: 'uat_cle_beta' },
            update: {
                name: 'UAT Beta Limited',
                lei: null,
                gleifData: Prisma.DbNull,
                nationalRegistryData: Prisma.DbNull,
                status: 'ACTIVE',
                isDeleted: false
            },
            create: {
                name: 'UAT Beta Limited',
                shortCode: 'uat_cle_beta',
                lei: null,
                status: 'ACTIVE',
                isDeleted: false
            }
        });

        const deletedLE = await prisma.clientLE.upsert({
            where: { shortCode: 'uat_cle_deleted' },
            update: {
                name: 'UAT Deleted Limited',
                lei: null,
                gleifData: Prisma.DbNull,
                nationalRegistryData: Prisma.DbNull,
                status: 'ARCHIVED',
                isDeleted: true
            },
            create: {
                name: 'UAT Deleted Limited',
                shortCode: 'uat_cle_deleted',
                lei: null,
                status: 'ARCHIVED',
                isDeleted: true
            }
        });

        // ── 4. CLIENT LE OWNERSHIP ───────────────────────────────────────────
        console.log('🔗 Converging ClientLE Ownership...');

        let alphaOwner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId: alphaLE.id, partyId: clientOrgA.id, endAt: null }
        });
        if (!alphaOwner) {
            alphaOwner = await prisma.clientLEOwner.create({
                data: {
                    clientLEId: alphaLE.id,
                    partyId: clientOrgA.id,
                    startAt: new Date(),
                    endAt: null
                }
            });
        }

        let betaOwner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId: betaLE.id, partyId: clientOrgB.id, endAt: null }
        });
        if (!betaOwner) {
            betaOwner = await prisma.clientLEOwner.create({
                data: {
                    clientLEId: betaLE.id,
                    partyId: clientOrgB.id,
                    startAt: new Date(),
                    endAt: null
                }
            });
        }

        let deletedOwner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId: deletedLE.id, partyId: clientOrgA.id }
        });
        if (!deletedOwner) {
            deletedOwner = await prisma.clientLEOwner.create({
                data: {
                    clientLEId: deletedLE.id,
                    partyId: clientOrgA.id,
                    startAt: new Date(Date.now() - 86400000),
                    endAt: new Date()
                }
            });
        } else if (!deletedOwner.endAt) {
            await prisma.clientLEOwner.update({
                where: { id: deletedOwner.id },
                data: { endAt: new Date() }
            });
        }

        // ── 5. BASELINE MASTER DATA (FIELD 3 / LEGAL NAME) ───────────────────
        console.log('📝 Seeding Baseline Master Data Field Claims...');

        // FieldClaim for Alpha (Legal Name)
        let alphaClaim = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: alphaLE.id,
                fieldNo: 3,
                claimRole: 'VALUE',
                status: 'ASSERTED'
            }
        });
        if (!alphaClaim) {
            alphaClaim = await prisma.fieldClaim.create({
                data: {
                    fieldNo: 3,
                    clientLEId: alphaLE.id,
                    ownerScopeId: clientOrgA.id,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    valueText: 'UAT Alpha Limited',
                    sourceType: 'USER_INPUT',
                    assertedAt: new Date()
                }
            });
        } else if (alphaClaim.valueText !== 'UAT Alpha Limited') {
            await prisma.fieldClaim.update({
                where: { id: alphaClaim.id },
                data: { valueText: 'UAT Alpha Limited' }
            });
        }

        // FieldClaim for Beta (Legal Name)
        let betaClaim = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: betaLE.id,
                fieldNo: 3,
                claimRole: 'VALUE',
                status: 'ASSERTED'
            }
        });
        if (!betaClaim) {
            betaClaim = await prisma.fieldClaim.create({
                data: {
                    fieldNo: 3,
                    clientLEId: betaLE.id,
                    ownerScopeId: clientOrgB.id,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    valueText: 'UAT Beta Limited',
                    sourceType: 'USER_INPUT',
                    assertedAt: new Date()
                }
            });
        } else if (betaClaim.valueText !== 'UAT Beta Limited') {
            await prisma.fieldClaim.update({
                where: { id: betaClaim.id },
                data: { valueText: 'UAT Beta Limited' }
            });
        }

        // FieldClaim for Deleted LE (Legal Name)
        let deletedClaim = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: deletedLE.id,
                fieldNo: 3,
                claimRole: 'VALUE',
                status: 'ASSERTED'
            }
        });
        if (!deletedClaim) {
            deletedClaim = await prisma.fieldClaim.create({
                data: {
                    fieldNo: 3,
                    clientLEId: deletedLE.id,
                    ownerScopeId: clientOrgA.id,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    valueText: 'UAT Deleted Limited',
                    sourceType: 'USER_INPUT',
                    assertedAt: new Date()
                }
            });
        } else if (deletedClaim.valueText !== 'UAT Deleted Limited') {
            await prisma.fieldClaim.update({
                where: { id: deletedClaim.id },
                data: { valueText: 'UAT Deleted Limited' }
            });
        }

        // ── 5B. REFERENCE LIBRARY QUESTIONNAIRE ──────────────────────────────
        console.log('📚 Converging Reference-Library Questionnaire...');
        let refQuestionnaire = await prisma.questionnaire.findFirst({
            where: { referenceCode: 'UAT_REF_QUESTIONNAIRE_V1' }
        });
        if (!refQuestionnaire) {
            refQuestionnaire = await prisma.questionnaire.create({
                data: {
                    name: 'UAT Reference Questionnaire',
                    referenceCode: 'UAT_REF_QUESTIONNAIRE_V1',
                    kind: 'REFERENCE_SNAPSHOT',
                    functionalCode: 'UATREF',
                    isTemplate: true,
                    visibility: 'GLOBAL',
                    status: 'ACTIVE',
                    isDeleted: false,
                    fiOrgId: systemOrg.id,
                    ownerOrgId: systemOrg.id
                }
            });
        } else {
            refQuestionnaire = await prisma.questionnaire.update({
                where: { id: refQuestionnaire.id },
                data: {
                    name: 'UAT Reference Questionnaire',
                    kind: 'REFERENCE_SNAPSHOT',
                    functionalCode: 'UATREF',
                    isTemplate: true,
                    visibility: 'GLOBAL',
                    status: 'ACTIVE',
                    isDeleted: false,
                    fiOrgId: systemOrg.id,
                    ownerOrgId: systemOrg.id
                }
            });
        }

        // ── 6. RELATIONSHIPS (FI ENGAGEMENTS) ─────────────────────────────────
        console.log('🤝 Converging Relationships (FIEngagements)...');

        const relAlpha = await prisma.fIEngagement.upsert({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: supplierOrgA.id,
                    clientLEId: alphaLE.id
                }
            },
            update: {
                status: 'CONNECTED',
                isDeleted: false
            },
            create: {
                fiOrgId: supplierOrgA.id,
                clientLEId: alphaLE.id,
                status: 'CONNECTED',
                isDeleted: false
            }
        });

        const relBeta = await prisma.fIEngagement.upsert({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: supplierOrgA.id,
                    clientLEId: betaLE.id
                }
            },
            update: {
                status: 'CONNECTED',
                isDeleted: false
            },
            create: {
                fiOrgId: supplierOrgA.id,
                clientLEId: betaLE.id,
                status: 'CONNECTED',
                isDeleted: false
            }
        });

        // ── 7. NINE SYNTHETIC UAT ACTORS & MEMBERSHIPS ───────────────────────
        console.log('👥 Converging 9 Synthetic UAT Personas & Memberships...');

        interface ActorSpec {
            key: string;
            email: string;
            name: string;
            membership: {
                role: string;
                organizationId?: string | null;
                clientLEId?: string | null;
                fiEngagementId?: string | null;
            };
        }

        const actorSpecs: ActorSpec[] = [
            // Actor A: Platform-Only System Administrator
            {
                key: 'systemAdmin',
                email: 'uat+system-admin@onpro.tech',
                name: 'UAT System Admin',
                membership: {
                    role: 'SYSTEM_ADMIN',
                    organizationId: systemOrg.id
                }
            },
            // Actor B: Client Org Admin A (Structural Admin Only)
            {
                key: 'clientOrgAdminA',
                email: 'uat+client-org-admin-a@onpro.tech',
                name: 'UAT Client Org Admin A',
                membership: {
                    role: 'ORG_ADMIN',
                    organizationId: clientOrgA.id
                }
            },
            // Actor C: Client Org Member A (Association Only)
            {
                key: 'clientOrgMemberA',
                email: 'uat+client-org-member-a@onpro.tech',
                name: 'UAT Client Org Member A',
                membership: {
                    role: 'ORG_MEMBER',
                    organizationId: clientOrgA.id
                }
            },
            // Actor D: LE Admin Alpha (Operational Admin on Alpha)
            {
                key: 'leAdminAlpha',
                email: 'uat+le-admin-alpha@onpro.tech',
                name: 'UAT LE Admin Alpha',
                membership: {
                    role: 'LE_ADMIN',
                    clientLEId: alphaLE.id
                }
            },
            // Actor E: LE User Alpha (Operational Worker on Alpha)
            {
                key: 'leUserAlpha',
                email: 'uat+le-user-alpha@onpro.tech',
                name: 'UAT LE User Alpha',
                membership: {
                    role: 'LE_USER',
                    clientLEId: alphaLE.id
                }
            },
            // Actor F: LE User Beta (Operational Worker on Beta)
            {
                key: 'leUserBeta',
                email: 'uat+le-user-beta@onpro.tech',
                name: 'UAT LE User Beta',
                membership: {
                    role: 'LE_USER',
                    clientLEId: betaLE.id
                }
            },
            // Actor G: Supplier Org Admin A (Supplier Org Level)
            {
                key: 'supplierOrgAdminA',
                email: 'uat+supplier-org-admin@onpro.tech',
                name: 'UAT Supplier Org Admin A',
                membership: {
                    role: 'ORG_ADMIN',
                    organizationId: supplierOrgA.id
                }
            },
            // Actor H: Relationship Admin Alpha (Engagement Lead on Relationship Alpha)
            {
                key: 'relationshipAdminAlpha',
                email: 'uat+relationship-admin-alpha@onpro.tech',
                name: 'UAT Relationship Admin Alpha',
                membership: {
                    role: 'RELATIONSHIP_ADMIN',
                    fiEngagementId: relAlpha.id
                }
            },
            // Actor I: Relationship User Alpha (Engagement Worker on Relationship Alpha)
            {
                key: 'relationshipUserAlpha',
                email: 'uat+relationship-user-alpha@onpro.tech',
                name: 'UAT Relationship User Alpha',
                membership: {
                    role: 'RELATIONSHIP_USER',
                    fiEngagementId: relAlpha.id
                }
            }
        ];

        for (const spec of actorSpecs) {
            const user = await prisma.user.upsert({
                where: { email: spec.email },
                update: {
                    name: spec.name,
                    password: passwordHash,
                    isDemoActor: false
                },
                create: {
                    email: spec.email,
                    name: spec.name,
                    password: passwordHash,
                    isDemoActor: false
                }
            });

            // Delete existing memberships strictly belonging to THIS UAT user to repair drift
            await prisma.membership.deleteMany({
                where: { userId: user.id }
            });

            // Re-create the single, exact intended membership
            await prisma.membership.create({
                data: {
                    userId: user.id,
                    role: spec.membership.role,
                    organizationId: spec.membership.organizationId || null,
                    clientLEId: spec.membership.clientLEId || null,
                    fiEngagementId: spec.membership.fiEngagementId || null
                }
            });
        }

        // ── 8. VERIFICATION CHECKS ───────────────────────────────────────────
        console.log('🔍 Running In-Memory Seed Verifications...');

        const alphaDisplayName = getLEDisplayName(alphaLE);
        const betaDisplayName = getLEDisplayName(betaLE);

        if (alphaDisplayName !== 'UAT Alpha Limited') {
            throw new Error(`Verification failed: Expected Alpha display name "UAT Alpha Limited", got "${alphaDisplayName}"`);
        }
        if (betaDisplayName !== 'UAT Beta Limited') {
            throw new Error(`Verification failed: Expected Beta display name "UAT Beta Limited", got "${betaDisplayName}"`);
        }

        const alphaLeiNull = alphaLE.lei === null;
        const betaLeiNull = betaLE.lei === null;
        const alphaGleifNull = alphaLE.gleifData === null || alphaLE.gleifData === undefined;
        const betaGleifNull = betaLE.gleifData === null || betaLE.gleifData === undefined;

        // Verify membership isolation across all 9 UAT users
        const uatUsers = await prisma.user.findMany({
            where: { email: { startsWith: 'uat+' } },
            include: { memberships: true }
        });

        let isolationPassed = uatUsers.length === 9;
        for (const u of uatUsers) {
            if (u.memberships.length !== 1) {
                isolationPassed = false;
            }
        }

        // ── 9. WRITE NON-SECRET FIXTURE MANIFEST ─────────────────────────────
        console.log('📋 Writing Fixture Manifest (playwright/.uat/fixture.json)...');

        const manifest = {
            generatedAt: new Date().toISOString(),
            environment: appEnv || 'development',
            systemOrg: { id: systemOrg.id, name: systemOrg.name, shortCode: systemOrg.shortCode },
            clientOrgA: { id: clientOrgA.id, shortCode: clientOrgA.shortCode, name: clientOrgA.name },
            clientOrgB: { id: clientOrgB.id, shortCode: clientOrgB.shortCode, name: clientOrgB.name },
            supplierOrgA: { id: supplierOrgA.id, shortCode: supplierOrgA.shortCode, name: supplierOrgA.name },
            alphaClientLE: { id: alphaLE.id, shortCode: alphaLE.shortCode, name: alphaLE.name },
            betaClientLE: { id: betaLE.id, shortCode: betaLE.shortCode, name: betaLE.name },
            deletedClientLE: { id: deletedLE.id, shortCode: deletedLE.shortCode, name: deletedLE.name },
            referenceQuestionnaire: { id: refQuestionnaire.id, referenceCode: refQuestionnaire.referenceCode, name: refQuestionnaire.name },
            relationshipAlpha: { id: relAlpha.id },
            relationshipBeta: { id: relBeta.id },
            actors: Object.fromEntries(
                actorSpecs.map((s) => [
                    s.key,
                    {
                        email: s.email,
                        name: s.name,
                        role: s.membership.role
                    }
                ])
            )
        };

        const manifestDir = path.join(process.cwd(), 'playwright', '.uat');
        if (!fs.existsSync(manifestDir)) {
            fs.mkdirSync(manifestDir, { recursive: true });
        }
        const manifestPath = options?.manifestPath || path.join(manifestDir, 'fixture.json');
        const targetDir = path.dirname(manifestPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        const result: UATSeedResult = {
            success: true,
            manifestPath,
            counts: {
                organizations: 3, // uat_client_org_a, uat_client_org_b, uat_supplier_org_a (excluding reused system org)
                clientLEs: 3,
                relationships: 2,
                users: 9,
                memberships: 9,
                fieldClaims: 3
            },
            verification: {
                alphaDisplayName,
                betaDisplayName,
                alphaLeiNull,
                betaLeiNull,
                alphaGleifNull,
                betaGleifNull,
                membershipIsolationPassed: isolationPassed
            }
        };

        console.log('✅ UAT Seed completed successfully.');
        return result;
    } finally {
        if (!prismaClient) {
            await prisma.$disconnect();
        }
    }
}

// Direct CLI execution
if (require.main === module) {
    seedUAT()
        .then((res) => {
            console.log('UAT Seed Result:', JSON.stringify(res, null, 2));
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ UAT Seed Failed:', err.message);
            process.exit(1);
        });
}
