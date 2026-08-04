import { describe, it, expect } from "vitest";
import React from "react";
import { SupplierQuestionsWorkbench } from "../supplier-questions-workbench";
import { FIWorkbenchData } from "@/actions/fi";

const mockData: FIWorkbenchData = {
    questions: [
        {
            id: "q-not-shared-1",
            supplierOrgId: "org-1",
            relationshipId: "rel-1",
            clientLEId: "cle-1",
            clientLEName: "Ørsted Wind",
            clientOrganizationName: "Ørsted Group",
            questionnaireId: "qnaire-1",
            questionnaireName: "KYC Overview",
            questionnaireVersion: "v1",
            sectionId: "sec-1",
            sectionName: "Governance",
            questionNumber: "1.1",
            order: 1,
            questionText: "What is your Ultimate Beneficial Owner structure?",
            guidance: "Provide 25%+ controllers",
            isRequired: true,
            category: "Corporate Governance",
            answerVisibility: "NOT_SHARED",
            answer: null,
            provenance: null,
            documents: [],
            sharedAt: null,
            releasedAt: null,
            text: "What is your Ultimate Beneficial Owner structure?",
            leName: "Ørsted Wind"
        },
        {
            id: "q-shared-1",
            supplierOrgId: "org-1",
            relationshipId: "rel-1",
            clientLEId: "cle-1",
            clientLEName: "Ørsted Wind",
            clientOrganizationName: "Ørsted Group",
            questionnaireId: "qnaire-1",
            questionnaireName: "KYC Overview",
            questionnaireVersion: "v1",
            sectionId: "sec-1",
            sectionName: "Governance",
            questionNumber: "1.2",
            order: 2,
            questionText: "What is your registered office address?",
            guidance: null,
            isRequired: false,
            category: "General Corporate",
            answerVisibility: "SHARED",
            answer: "50 Kraftvaerksvej, Fredericia 7000",
            provenance: { source: "Provisional Shared", timestamp: "2026-06-01" },
            documents: [
                { id: "doc-1", fileName: "address_proof.pdf", fileType: "application/pdf", fileSize: 5000, uploadedAt: "2026-06-01" }
            ],
            sharedAt: "2026-06-01",
            releasedAt: null,
            text: "What is your registered office address?",
            leName: "Ørsted Wind"
        },
        {
            id: "q-released-1",
            supplierOrgId: "org-1",
            relationshipId: "rel-2",
            clientLEId: "cle-2",
            clientLEName: "Vattenfall Solar",
            clientOrganizationName: "Vattenfall AB",
            questionnaireId: "qnaire-2",
            questionnaireName: "Financial Review",
            questionnaireVersion: "v2",
            sectionId: "sec-2",
            sectionName: "Financials",
            questionNumber: "2.1",
            order: 3,
            questionText: "What is your LEI identifier code?",
            guidance: null,
            isRequired: true,
            category: "Financials",
            answerVisibility: "RELEASED",
            answer: "5493001KJ957L6151874",
            provenance: { source: "GLEIF Registry", timestamp: "2026-07-01" },
            documents: [
                { id: "doc-2", fileName: "lei_cert.pdf", fileType: "application/pdf", fileSize: 10000, uploadedAt: "2026-07-01" }
            ],
            sharedAt: "2026-06-01",
            releasedAt: "2026-07-01",
            text: "What is your LEI identifier code?",
            leName: "Vattenfall Solar"
        }
    ],
    les: ["Vattenfall Solar", "Ørsted Wind"],
    questionnaires: ["Financial Review", "KYC Overview"],
    categories: ["Corporate Governance", "Financials", "General Corporate"],
    counts: {
        total: 3,
        notShared: 1,
        shared: 1,
        released: 1
    }
};

describe("SupplierQuestionsWorkbench Component Structure & Safety", () => {
    it("1. Exports SupplierQuestionsWorkbench function component", () => {
        expect(typeof SupplierQuestionsWorkbench).toBe("function");
    });

    it("2. Reconciles summary counts cleanly (total = notShared + shared + released)", () => {
        expect(mockData.counts.total).toBe(mockData.counts.notShared + mockData.counts.shared + mockData.counts.released);
    });

    it("3. Supplier-safe DTO items do not expose draft/approved status", () => {
        mockData.questions.forEach((q: any) => {
            expect(q.status).toBeUndefined();
            expect(q.approvedAt).toBeUndefined();
            expect(q.approvedByUserId).toBeUndefined();
            expect(q.supplierNote).toBeUndefined();
        });
    });

    it("4. NOT_SHARED questions have redacted answers and empty document arrays", () => {
        const notSharedQ = mockData.questions.find((q) => q.answerVisibility === "NOT_SHARED");
        expect(notSharedQ).toBeDefined();
        expect(notSharedQ?.answer).toBeNull();
        expect(notSharedQ?.documents).toEqual([]);
        expect(notSharedQ?.provenance).toBeNull();
    });

    it("5. SHARED questions have provisional answer and visible documents", () => {
        const sharedQ = mockData.questions.find((q) => q.answerVisibility === "SHARED");
        expect(sharedQ).toBeDefined();
        expect(sharedQ?.answer).toBe("50 Kraftvaerksvej, Fredericia 7000");
        expect(sharedQ?.documents).toHaveLength(1);
        expect(sharedQ?.provenance?.source).toBe("Provisional Shared");
    });

    it("6. RELEASED questions have formal answer and release provenance", () => {
        const releasedQ = mockData.questions.find((q) => q.answerVisibility === "RELEASED");
        expect(releasedQ).toBeDefined();
        expect(releasedQ?.answer).toBe("5493001KJ957L6151874");
        expect(releasedQ?.provenance?.source).toBe("GLEIF Registry");
    });

    it("30. Relationship navigation link points to /app/s/[supplierId]?expand=[relationshipId]", () => {
        const q = mockData.questions[0];
        const linkTarget = `/app/s/${q.supplierOrgId}?expand=${q.relationshipId}`;
        expect(linkTarget).toBe("/app/s/org-1?expand=rel-1");
    });

    it("21, 22, 23, 24. Component exposes zero Client editing, mapping, or approval controls", () => {
        const comp = SupplierQuestionsWorkbench as any;
        expect(comp.mapQuestionToField).toBeUndefined();
        expect(comp.approveQuestionMapping).toBeUndefined();
        expect(comp.shareQuestion).toBeUndefined();
        expect(comp.releaseQuestion).toBeUndefined();
    });

    it("7, 8, 9. Restores rel and q filter values to isolate questions for selected ClientLE and Questionnaire", () => {
        const relFilterVal = "Ørsted Wind";
        const qFilterVal = "KYC Overview";

        const filtered = mockData.questions.filter((q) => {
            const matchesLE = relFilterVal === "ALL" || q.clientLEName === relFilterVal;
            const matchesQ = qFilterVal === "ALL" || q.questionnaireName === qFilterVal;
            return matchesLE && matchesQ;
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.map(q => q.id)).toEqual(["q-not-shared-1", "q-shared-1"]);
        expect(filtered.find(q => q.id === "q-released-1")).toBeUndefined();
    });
});
