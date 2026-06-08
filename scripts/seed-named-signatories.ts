/**
 * seed-named-signatories.ts
 *
 * One-shot seed: creates the Named Signatories MasterFieldDefinition (fieldNo 125)
 * and its MasterFieldGraphBinding if they do not already exist.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/seed-named-signatories.ts
 */

import prisma from '../src/lib/prisma';

const FIELD_NO = 125;
const STAKEHOLDER_CATEGORY_ID = 'cbf46368-0631-4c00-85c5-c225e8c91c51'; // "Stakeholder"

async function main() {
    console.log('── Named Signatories seed ──────────────────────────────────────');

    // 1. MasterFieldDefinition
    const existing = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: FIELD_NO },
    });

    if (existing) {
        if (existing.fieldName !== 'Named Signatories') {
            // fieldNo 125 is already taken by something else — abort cleanly.
            // Update COMPLEX_FIELD_CONFIG in code to use a different fieldNo
            // (whatever the next available ID is) and re-run this script.
            console.error(
                `  ✗ ABORT: fieldNo=${FIELD_NO} already exists as "${existing.fieldName}" — ` +
                `not "Named Signatories". Update FIELD_NO constant in this script and in ` +
                `COMPLEX_FIELD_CONFIG to a different value and re-run.`
            );
            process.exit(1);
        }
        console.log(`  ✓ MasterFieldDefinition fieldNo=${FIELD_NO} already exists ("${existing.fieldName}") — skipping create.`);
    } else {
        // Use raw SQL so we can specify an explicit fieldNo.
        // ⚠️  After this insert we MUST advance the Postgres sequence so that
        //    future auto-increment inserts don't attempt to reuse fieldNo 125
        //    and crash with a unique constraint violation.
        await prisma.$executeRaw`
            INSERT INTO master_field_definitions
                ("fieldNo", "fieldName", "appDataType", "isMultiValue", "isActive", "order",
                 "categoryId", "notes", "createdAt", "updatedAt")
            VALUES
                (${FIELD_NO}, 'Named Signatories', 'PARTY_REF', true, true, 125.0,
                 ${STAKEHOLDER_CATEGORY_ID},
                 'Persons who are authorised to sign on behalf of this legal entity. User-curated only.',
                 now(), now())
        `;

        // Advance the sequence to at least FIELD_NO so the next auto-increment
        // yields FIELD_NO+1 or higher — never FIELD_NO itself again.
        // setval(seq, val, is_called=true) means "next nextval() returns val+1".
        await prisma.$executeRaw`
            SELECT setval(
                pg_get_serial_sequence('master_field_definitions', 'fieldNo'),
                GREATEST(${FIELD_NO}, currval(pg_get_serial_sequence('master_field_definitions', 'fieldNo')))
            )
        `;

        console.log(`  ✓ Created MasterFieldDefinition fieldNo=${FIELD_NO} "Named Signatories".`);
        console.log(`  ✓ Sequence advanced to GREATEST(${FIELD_NO}, current) — next auto-increment will be ≥${FIELD_NO + 1}.`);
    }

    // 2. MasterFieldGraphBinding
    const existingBinding = await (prisma as any).masterFieldGraphBinding.findFirst({
        where: { fieldNo: FIELD_NO },
    });

    if (existingBinding) {
        console.log(`  ✓ MasterFieldGraphBinding for fieldNo=${FIELD_NO} already exists — skipping create.`);
    } else {
        await (prisma as any).masterFieldGraphBinding.create({
            data: {
                fieldNo:           FIELD_NO,
                graphNodeType:     'PERSON',
                filterEdgeType:    'NAMED_SIGNATORY',
                filterActiveOnly:  true,
                writeBackEdgeType: 'NAMED_SIGNATORY',
                writeBackIsActive: true,
                pickerLabel:       'Select Signatory',
                allowCreate:       true,
                isActive:          true,
            },
        });
        console.log(`  ✓ Created MasterFieldGraphBinding (PERSON / NAMED_SIGNATORY edge).`);
    }

    console.log('\n✓ Seed complete.');
}

main()
    .catch(err => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
