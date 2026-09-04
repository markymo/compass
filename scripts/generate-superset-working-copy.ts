import { generateSupersetWorkingCopy } from "../src/lib/questionnaires/superset-generator";
import prisma from "../src/lib/prisma";

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const force = args.includes("--force");

    console.log("==================================================");
    console.log("ONP-187: Generate Superset Working Copy Questionnaire");
    console.log(`Mode: ${dryRun ? "DRY RUN (no database writes)" : force ? "FORCE (recreate existing)" : "STANDARD (idempotent)"}`);
    console.log("==================================================\n");

    const result = await generateSupersetWorkingCopy({ dryRun, force });

    if (!result.success) {
        console.error("❌ Failed:", result.error);
        process.exit(1);
    }

    if (result.dryRun) {
        console.log(`✅ Dry Run Succeeded!`);
        console.log(`  Proposed Name:  ${result.proposedName}`);
        console.log(`  Question Count: ${result.questionCount}`);
        console.log(`  First 3 fields:`, result.items?.slice(0, 3).map(i => `[${i.masterFieldNo}] ${i.text}`));
        console.log(`  Last 3 fields:`, result.items?.slice(-3).map(i => `[${i.masterFieldNo}] ${i.text}`));
        console.log("\nZero database writes performed.");
        return;
    }

    if (result.isExisting) {
        console.log(`ℹ️  Existing SUPERSET Working Copy found (use --force to recreate):`);
    } else {
        console.log(`✅ Successfully created SUPERSET Working Copy!`);
    }

    console.log(`  Questionnaire ID: ${result.questionnaireId}`);
    console.log(`  Questions Mapped: ${result.questionCount}`);
    console.log(`  Admin URL:        /app/admin/questionnaires/${result.questionnaireId}`);
    console.log(`  V2 Explorer URL:  /app/admin/questionnaires-v2?tab=working-copy`);
}

main()
    .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
