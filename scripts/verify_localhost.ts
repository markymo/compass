import prisma from "../src/lib/prisma";
import { resolveQuestionnaireContext } from "../src/lib/kyc/engagement-context";
import { resolveExportAnswer } from "../src/lib/export/export-answer-resolver";
import { KycStateService } from "../src/lib/kyc/KycStateService";

async function run() {
    const questions = await prisma.question.findMany({
        where: { masterFieldNo: 138 },
        include: { questionnaire: true }
    });
    console.log("Found questions with field 138:", questions.length);

    if (questions.length === 0) return;
    
    for (const q4 of questions) {
        const q = q4.questionnaire;
        console.log(`\n--- ${q.name} (${q.id}) ---`);
        console.log("Is deleted?", q.isDeleted);
        
        const ctx = await resolveQuestionnaireContext(q.id);
        console.log("Context from helper:", JSON.stringify({
            subjectLeId: ctx?.subjectLeId,
            clientLeId: ctx?.clientLeId,
            ownerScopeId: ctx?.ownerScopeId
        }, null, 2));

        if (!ctx?.subjectLeId || !ctx?.clientLeId) {
            console.log("Skipping, no context...");
            continue;
        }

        console.log("Q4 Record:", q4.id, q4.text, "masterFieldNo:", q4.masterFieldNo, "status:", q4.status, "releasedAt:", q4.releasedAt);

        // Try getting authoritative value
        const isReleased = q4.status === 'RELEASED';
        const snapshotDate = isReleased ? q4.releasedAt : undefined;
        
        console.log("Attempting to get Authoritative Value with snapshotDate:", snapshotDate);
        const authVal = await KycStateService.getAuthoritativeValue(
            { subjectLeId: ctx.subjectLeId, clientLEId: ctx.clientLeId },
            q4.masterFieldNo!,
            ctx.ownerScopeId,
            snapshotDate
        );

        console.log("Auth Val result:", !!authVal, "status:", authVal?.status, "assertedAt:", authVal?.assertedAt, "value:", authVal?.value);

        console.log("Attempting without snapshotDate...");
        const authValLive = await KycStateService.getAuthoritativeValue(
            { subjectLeId: ctx.subjectLeId, clientLEId: ctx.clientLeId },
            q4.masterFieldNo!,
            ctx.ownerScopeId,
            undefined
        );
        console.log("Live Auth Val result:", !!authValLive, "status:", authValLive?.status, "assertedAt:", authValLive?.assertedAt, "value:", authValLive?.value);

        console.log("Calling resolveExportAnswer...");
        const resolved = await resolveExportAnswer(q4, ctx.subjectLeId, ctx.ownerScopeId, ctx.clientLeId);
        console.log("resolveExportAnswer displayValue:", resolved.displayValue, "answerState:", resolved.answerState);
    }
}

run().catch(console.error).finally(() => process.exit(0));
