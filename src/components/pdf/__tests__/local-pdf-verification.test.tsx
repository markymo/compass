import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { QuestionnairePDF } from '../questionnaire-pdf';
import PDFParser from 'pdf2json';

describe('Local Questionnaire PDF Verification (ONP-200 & ONP-201)', () => {
    const testData = [
        {
            id: "q1",
            status: "VERIFIED",
            question: "Redemption cycle (hedge / PE funds only)",
            answer: "Not applicable",
            sourceLabel: "Self Certified",
            sourceTimestamp: "2026-09-01T12:00:00Z"
        },
        {
            id: "q2",
            status: "RELEASED",
            question: "Current Active Directors",
            answer: "Alice Smith\nBob Jones\nCarol White",
            sourceLabel: "Companies House",
            sourceTimestamp: "2026-09-10T14:30:00Z"
        },
        {
            id: "q3",
            status: "VERIFIED",
            question: "Certificate of Incorporation",
            answer: "Document attached",
            attachmentFilenames: ["certificate_of_incorporation_2026.pdf"],
            sourceLabel: "Companies House",
            sourceTimestamp: "2026-09-05T09:15:00Z"
        },
        {
            id: "q4",
            status: "DRAFT",
            question: "Custom Direct Contract (Unmapped Question)",
            answer: "Document attached",
            attachmentFilenames: ["master_services_agreement_v2.pdf"],
            sourceLabel: "Questionnaire answer"
        },
        {
            id: "q5",
            status: "VERIFIED",
            question: "Proof of Identity & Address",
            answer: "Documents attached",
            attachmentFilenames: ["director_passport.pdf", "council_tax_statement.pdf"],
            sourceLabel: "Master Data attachment",
            sourceTimestamp: "2026-09-12T16:45:00Z"
        },
        {
            id: "q6",
            status: "VERIFIED",
            question: "Key Corporate Officers",
            answer: "Group Data",
            groupDisplayStyle: 'LIST' as const,
            groupFields: [
                {
                    fieldNo: 1,
                    label: "Chief Compliance Officer",
                    displayValue: "Jane Doe",
                    order: 1,
                    sourceLabel: "FCA Registry",
                    attachmentFilenames: ["fca_approval_notice.pdf"]
                },
                {
                    fieldNo: 2,
                    label: "Chief Risk Officer",
                    displayValue: "John Doe",
                    order: 2,
                    sourceLabel: "Self Certified"
                }
            ]
        }
    ];

    const metadata = {
        exportId: "EXP-ONP-200-201",
        generatedAt: "2026-09-15T15:00:00Z",
        generatedBy: "System Verification",
        clientDisplayName: "Alpha Investment Partners",
        supplierDisplayName: "Acme Custody Services Ltd",
        exportFormatVersion: "1.0.0",
        applicationVersion: "0.1.0",
        timezone: "UTC",
        summaryStats: {
            totalQuestions: 6,
            answered: 6,
            registrySourced: 3,
            userSupplied: 3,
            noResponse: 0,
            dueDate: "2026-10-01"
        }
    };

    it('generates real PDF and validates ONP-200 & ONP-201 criteria without warnings or corruption', async () => {
        const doc = <QuestionnairePDF title="ONP-200 & ONP-201 Verification" data={testData as any} exportMetadata={metadata as any} />;
        const stream = await renderToStream(doc);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        expect(buffer.length).toBeGreaterThan(1000);

        const rawText = await new Promise<string>((resolve, reject) => {
            const parser = new PDFParser(null, true);
            parser.on("pdfParser_dataError", (err: any) => reject(err.parserError));
            parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
            parser.parseBuffer(buffer);
        });

        // 1. ONP-200: "Answer:" prefix must be completely absent
        const answerPrefixMatches = rawText.match(/Answer:/g) || [];
        expect(answerPrefixMatches).toHaveLength(0);

        // 2. ONP-201: Deprecated "Evidence Attached:" must be absent
        const evidenceAttachedMatches = rawText.match(/Evidence Attached/gi) || [];
        expect(evidenceAttachedMatches).toHaveLength(0);

        // 3. ONP-201: Deprecated "Evidence" must not appear
        const evidenceMatches = rawText.match(/\bEvidence\b/g) || [];
        expect(evidenceMatches).toHaveLength(0);

        // 4. ONP-201: Corrupted emoji glyph must not appear
        const emojiMatches = rawText.match(/📄/g) || [];
        expect(emojiMatches).toHaveLength(0);

        // 5. Canonical Attachments header must appear for each question with attachments (q3, q4, q5, q6 = 4)
        const attachmentsHeaderMatches = rawText.match(/Attachments/g) || [];
        expect(attachmentsHeaderMatches.length).toBe(4);

        // 6. Each attachment filename must appear exactly once
        const filenames = [
            "certificate_of_incorporation_2026.pdf",
            "master_services_agreement_v2.pdf",
            "director_passport.pdf",
            "council_tax_statement.pdf",
            "fca_approval_notice.pdf"
        ];
        for (const fname of filenames) {
            const count = (rawText.match(new RegExp(fname, "g")) || []).length;
            expect(count).toBe(1);
        }

        // 7. Single and multiline answer contents preserved
        expect(rawText).toContain("Not applicable");
        expect(rawText).toContain("Alice Smith");
        expect(rawText).toContain("Bob Jones");
        expect(rawText).toContain("Carol White");

        // 8. Source & Last validated metadata preserved
        expect(rawText).toContain("Companies House");
        expect(rawText).toContain("Last validated:");
    });
});
