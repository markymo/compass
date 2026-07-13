import { PrismaClient } from '@prisma/client';
import { del } from '@vercel/blob';

const prisma = new PrismaClient();

async function run() {
    const isDryRun = !process.argv.includes('--execute');

    console.log(`\n=== Legacy Field Attachment Cleanup ===`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);

    const legacyToken = process.env.LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN;
    if (!isDryRun && !legacyToken) {
        console.error("FATAL: LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN is missing. Failing closed to prevent deletion with wrong/missing credential.");
        process.exit(1);
    }

    // Criteria:
    // 1. masterFieldKey is not null
    // 2. docType is EVIDENCE
    // 3. fileUrl contains '.public.blob.vercel-storage.com'
    // 4. storagePath is null
    // 5. isPrivate is false or null
    
    const legacyDocs = await prisma.document.findMany({
        where: {
            masterFieldKey: { not: null },
            docType: 'EVIDENCE',
            fileUrl: {
                contains: '.public.blob.vercel-storage.com'
            },
            storagePathname: null,
            storageProvider: null
        },
        include: {
            // Prisma schema reference checks
            fieldClaimsAsAttachment: true,
            prefilledForQuestion: true,
            question: true,
            sharedWith: true,
            privateDocumentUploadIntent: true
        }
    });

    let selectedCount = 0;
    let skippedCount = 0;
    let blobDeletedCount = 0;
    let blobAbsentCount = 0;
    let dbDeletedCount = 0;
    let failedCount = 0;

    const docsToProcess = [];

    console.log(`\nFound ${legacyDocs.length} matching legacy documents based on criteria.`);

    for (const doc of legacyDocs) {
        // Evaluate references
        // Note: FieldClaim.valueDocId points to DocumentRegistry, not Document.
        const refAttachment = doc.fieldClaimsAsAttachment ? doc.fieldClaimsAsAttachment.length : 0;
        const refPrefilled = doc.prefilledForQuestion ? 1 : 0;
        const refQuestion = doc.question ? 1 : 0;
        const refShared = doc.sharedWith ? doc.sharedWith.length : 0;
        const refIntent = doc.privateDocumentUploadIntent ? 1 : 0;
        
        const totalRefs = refAttachment + refPrefilled + refQuestion + refShared + refIntent;

        if (totalRefs > 0) {
            console.log(`\n[SKIPPED] Document ID: ${doc.id}`);
            console.log(`   References found: attachmentDocumentId: ${refAttachment}, prefilledForQuestion: ${refPrefilled}, question: ${refQuestion}, sharedWith: ${refShared}, intent: ${refIntent}`);
            skippedCount++;
            continue;
        }

        docsToProcess.push(doc);
    }

    selectedCount = docsToProcess.length;

    if (isDryRun) {
        console.log(`\n[DRY RUN] Would process ${selectedCount} documents:`);
        for (const doc of docsToProcess) {
            // Mask URL
            const url = doc.fileUrl || '';
            const maskedUrl = url.substring(0, 35) + '...' + url.substring(url.length - 10);
            
            console.log(` - Document ID: ${doc.id}`);
            console.log(`   Field: ${doc.masterFieldKey}`);
            console.log(`   URL: ${maskedUrl}`);
            console.log(`   References: 0`);
        }
        
        console.log(`\n=== Dry Run Summary ===`);
        console.log(`Selected for deletion: ${selectedCount}`);
        console.log(`Skipped (referenced):  ${skippedCount}`);
        console.log("\n[DRY RUN] Re-run with --execute and LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN to perform deletion.");
        return;
    }

    console.log(`\n[EXECUTE] Starting deletion of ${selectedCount} documents...`);

    for (const doc of docsToProcess) {
        console.log(`Processing Document: ${doc.id}`);
        let blobDeletedOrAbsent = false;

        if (doc.fileUrl) {
            try {
                await del(doc.fileUrl, { token: legacyToken });
                console.log(` - Blob deleted successfully.`);
                blobDeletedCount++;
                blobDeletedOrAbsent = true;
            } catch (err: any) {
                if (err.message && (err.message.includes('not found') || err.message.includes('404'))) {
                    console.log(` - Blob already absent.`);
                    blobAbsentCount++;
                    blobDeletedOrAbsent = true;
                } else {
                    console.error(` - Failed to delete Blob:`, err.message);
                    failedCount++;
                }
            }
        } else {
            console.log(` - No URL to delete, treating as absent.`);
            blobAbsentCount++;
            blobDeletedOrAbsent = true;
        }

        if (blobDeletedOrAbsent) {
            try {
                await prisma.document.delete({
                    where: { id: doc.id }
                });
                console.log(` - DB record deleted successfully.`);
                dbDeletedCount++;
            } catch (err: any) {
                console.error(` - Failed to delete DB record (BLOB WAS DELETED/ABSENT):`, err.message);
                failedCount++;
            }
        }
    }

    console.log(`\n=== Final Execution Summary ===`);
    console.log(`Selected:             ${selectedCount}`);
    console.log(`Skipped (referenced): ${skippedCount}`);
    console.log(`Blob deleted:         ${blobDeletedCount}`);
    console.log(`Blob already absent:  ${blobAbsentCount}`);
    console.log(`Database deleted:     ${dbDeletedCount}`);
    console.log(`Failed:               ${failedCount}`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
