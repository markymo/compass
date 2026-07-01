import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// DO NOT set to true without explicit approval
const LIVE_RUN = false;

async function main() {
    console.log("==========================================");
    console.log(`Starting Migration Script (LIVE_RUN = ${LIVE_RUN})`);
    console.log("==========================================\n");

    const allQuestionnaires = await prisma.questionnaire.findMany({
        include: {
            commonForClients: { select: { id: true, shortCode: true } },
            fiEngagement: { select: { id: true, clientLE: { select: { shortCode: true } }, org: { select: { shortCode: true } } } },
            source: { select: { id: true, name: true } }
        }
    });

    let fixedEngagementCount = 0;
    let fixedCommonCount = 0;
    let fallbackNamesCount = 0;

    for (const q of allQuestionnaires) {
        let updates: any = {};
        
        // 1. ENGAGEMENT QUESTIONNAIRES
        if (q.fiEngagementId && q.kind === "ENGAGEMENT_QUESTIONNAIRE") {
            // Check if it suffers from the Field Swap Bug
            // Bug characteristics: `name` has no spaces and contains underscores, while `referenceCode` contains XXXXX/SSSSS
            const nameLooksLikeCode = q.name && !q.name.includes(" ") && q.name.includes("_");
            const refHasPlaceholders = q.referenceCode && (q.referenceCode.includes("XXXXX") || q.referenceCode.includes("SSSSS"));

            if (nameLooksLikeCode && refHasPlaceholders) {
                const targetRefCode = q.name;
                
                let targetName = q.source?.name;
                if (!targetName || targetName === q.source?.referenceCode || targetName.includes("XXXXX") || targetName.includes("SSSSS")) {
                    targetName = targetRefCode; // fallback to the resolved reference code if the source name is also a placeholder
                }

                console.log(`[ENGAGEMENT] Fixing ID: ${q.id}`);
                console.log(`  Current Name: "${q.name}"`);
                console.log(`  Current Ref:  "${q.referenceCode}"`);
                
                if (targetName) {
                    console.log(`  -> Swapping. New Name: "${targetName}", New Ref: "${targetRefCode}"`);
                    updates = { name: targetName, referenceCode: targetRefCode };
                } else {
                    console.log(`  -> WARNING: No sourceId available to recover name. Leaving name as-is. Fixing refCode.`);
                    updates = { referenceCode: targetRefCode };
                    fallbackNamesCount++;
                }
                fixedEngagementCount++;
            }
        }

        // 2. COMMON QUESTIONNAIRES
        if (q.commonForClients.length > 0) {
            console.log(`[COMMON] Fixing ID: ${q.id}`);
            console.log(`  Current Kind: "${q.kind}"`);
            
            if (q.kind !== "COMMON_QUESTIONNAIRE") {
                updates.kind = "COMMON_QUESTIONNAIRE";
                console.log(`  -> Updating Kind to COMMON_QUESTIONNAIRE`);
            }

            const refHasPlaceholders = q.referenceCode && (q.referenceCode.includes("XXXXX") || q.referenceCode.includes("SSSSS"));
            
            let newRef = q.referenceCode;
            if (refHasPlaceholders) {
                const clientLe = q.commonForClients[0];
                const leCode = clientLe.shortCode || "XXXXX";
                const template = q.source;

                if (q.referenceCode) {
                    const contextualPrefix = q.referenceCode
                        .replace(/_v\d+$/, "")
                        .replace(/_(XXXXX)(?=_|$)/, `_${leCode}`)
                        .replace(/_(S{4,})(?=_|$)/, `_COMMON`);
                    
                    const existingInstances = await prisma.questionnaire.findMany({
                        where: {
                            commonForClients: { some: { id: clientLe.id } },
                            referenceCode: { startsWith: contextualPrefix },
                            id: { not: q.id }
                        },
                        select: { referenceCode: true }
                    });
                    
                    const existingCodes = existingInstances.map((e: any) => e.referenceCode).filter(Boolean) as string[];
                    
                    if (!existingCodes.includes(contextualPrefix)) {
                        newRef = contextualPrefix;
                    } else {
                        const { computeNextVersion } = await import("../src/lib/questionnaires/reference-codes");
                        let nextVersion = computeNextVersion(contextualPrefix, existingCodes);
                        if (nextVersion === 1) nextVersion = 2;
                        newRef = `${contextualPrefix}_v${nextVersion}`;
                    }

                    console.log(`  -> Resolving RefCode from "${q.referenceCode}" to "${newRef}"`);
                    updates.referenceCode = newRef;
                }
            }
            
            // If the name got messed up (unlikely for common since they just copied), we restore it
            const nameLooksLikeCode = q.name && !q.name.includes(" ") && q.name.includes("_");
            const template = q.source;
            if (nameLooksLikeCode && template?.name) {
                let targetName = template.name;
                if (!targetName || targetName === template.referenceCode || targetName.includes("XXXXX") || targetName.includes("SSSSS")) {
                    targetName = newRef || targetName;
                }
                
                if (q.name !== targetName) {
                    console.log(`  -> Restoring Name from "${q.name}" to "${targetName}"`);
                    updates.name = targetName;
                }
            }
            if (Object.keys(updates).length > 0) {
                fixedCommonCount++;
            }
        }

        // EXECUTE UPDATE
        if (Object.keys(updates).length > 0) {
            if (LIVE_RUN) {
                await prisma.questionnaire.update({
                    where: { id: q.id },
                    data: updates
                });
                console.log(`  [UPDATE APPLIED]`);
            } else {
                console.log(`  [DRY RUN] Would apply updates:`, updates);
            }
            console.log(""); // newline
        }
    }

    console.log("==========================================");
    console.log("Migration Summary:");
    console.log(`- Engagement instances fixed: ${fixedEngagementCount}`);
    console.log(`- Common instances fixed: ${fixedCommonCount}`);
    console.log(`- Missing sourceIds (fallback): ${fallbackNamesCount}`);
    console.log(`- LIVE_RUN was: ${LIVE_RUN ? 'TRUE (Updates applied)' : 'FALSE (No changes made)'}`);
    console.log("==========================================");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
