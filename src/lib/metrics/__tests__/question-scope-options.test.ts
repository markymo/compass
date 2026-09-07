import { describe, it, expect } from "vitest";
import {
    isQuestionInPopulationScope,
    deriveEligibleQuestionnaireOptions,
    deriveEligibleSupplierQuestionnaires,
    QuestionScopeTarget,
    QuestionScope,
} from "@/lib/metrics/question-scope";

describe("ONP-19 — Production Questionnaire Scoping & Options Contract", () => {
    const mockQuestions: (QuestionScopeTarget & { id: string; text: string })[] = [
        // Relationship A (Barclays): Questionnaire A (3 questions)
        {
            id: "q-barclays-1",
            fiEngagementId: "eng-barclays",
            questionnaireId: "q-barclays-inst",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Due Diligence",
            isCommon: false,
            text: "Barclays Q1",
        },
        {
            id: "q-barclays-2",
            fiEngagementId: "eng-barclays",
            questionnaireId: "q-barclays-inst",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Due Diligence",
            isCommon: false,
            text: "Barclays Q2",
        },
        {
            id: "q-barclays-3",
            fiEngagementId: "eng-barclays",
            questionnaireId: "q-barclays-inst",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Due Diligence",
            isCommon: false,
            text: "Barclays Q3",
        },

        // Relationship B (Riskbridge): Questionnaire B (2 questions)
        {
            id: "q-riskbridge-1",
            fiEngagementId: "eng-riskbridge",
            questionnaireId: "q-riskbridge-inst",
            engagementOrgName: "Riskbridge Associates",
            questionnaireName: "Riskbridge Onboarding",
            isCommon: false,
            text: "Riskbridge Q1",
        },
        {
            id: "q-riskbridge-2",
            fiEngagementId: "eng-riskbridge",
            questionnaireId: "q-riskbridge-inst",
            engagementOrgName: "Riskbridge Associates",
            questionnaireName: "Riskbridge Onboarding",
            isCommon: false,
            text: "Riskbridge Q2",
        },

        // Common Questionnaire C (Applies to all relationships of ClientLE, 2 questions)
        {
            id: "cq-1",
            fiEngagementId: undefined,
            questionnaireId: "cq-inst",
            engagementOrgName: "Common",
            questionnaireName: "Common Reference Profile",
            isCommon: true,
            text: "Common Q1",
        },
        {
            id: "cq-2",
            fiEngagementId: undefined,
            questionnaireId: "cq-inst",
            engagementOrgName: "Common",
            questionnaireName: "Common Reference Profile",
            isCommon: true,
            text: "Common Q2",
        },
    ];

    describe("1. deriveEligibleQuestionnaireOptions Scoping Contract", () => {
        it("under 'ALL' relationships: includes all 3 questionnaires (Questionnaire A, B, and Common C)", () => {
            const options = deriveEligibleQuestionnaireOptions(mockQuestions, {
                relationshipId: "ALL",
                rel: "ALL",
            });
            expect(options.map(o => o.name)).toEqual([
                "Barclays Due Diligence",
                "Common Reference Profile",
                "Riskbridge Onboarding",
            ]);
            expect(options.map(o => o.id)).toEqual([
                "q-barclays-inst",
                "cq-inst",
                "q-riskbridge-inst",
            ]);
        });

        it("under 'Barclays' relationship (by stable ID): includes Questionnaire A and Common C, excludes Questionnaire B", () => {
            const options = deriveEligibleQuestionnaireOptions(mockQuestions, {
                relationshipId: "eng-barclays",
                rel: "ALL",
            });
            expect(options.map(o => o.name)).toEqual([
                "Barclays Due Diligence",
                "Common Reference Profile",
            ]);
            expect(options.find(o => o.name === "Riskbridge Onboarding")).toBeUndefined();
        });

        it("under 'Barclays' relationship (by legacy name): includes Questionnaire A and Common C, excludes Questionnaire B", () => {
            const options = deriveEligibleQuestionnaireOptions(mockQuestions, {
                relationshipId: "ALL",
                rel: "Barclays",
            });
            expect(options.map(o => o.name)).toEqual([
                "Barclays Due Diligence",
                "Common Reference Profile",
            ]);
            expect(options.find(o => o.name === "Riskbridge Onboarding")).toBeUndefined();
        });

        it("under 'Riskbridge' relationship (by stable ID): includes Questionnaire B and Common C, excludes Questionnaire A", () => {
            const options = deriveEligibleQuestionnaireOptions(mockQuestions, {
                relationshipId: "eng-riskbridge",
                rel: "ALL",
            });
            expect(options.map(o => o.name)).toEqual([
                "Common Reference Profile",
                "Riskbridge Onboarding",
            ]);
            expect(options.find(o => o.name === "Barclays Due Diligence")).toBeUndefined();
        });

        it("under 'Common' relationship: includes ONLY Common Questionnaire C", () => {
            const options = deriveEligibleQuestionnaireOptions(mockQuestions, {
                relationshipId: "ALL",
                rel: "Common",
            });
            expect(options.map(o => o.name)).toEqual([
                "Common Reference Profile",
            ]);
        });
    });

    describe("2. Scope Conjunction & Common Questionnaire Invariant", () => {
        it("Common Questionnaire C resolves valid questions when scoped under Relationship A", () => {
            const scope: QuestionScope = {
                relationshipId: "eng-barclays",
                questionnaireId: "cq-inst",
            };
            const visibleQuestions = mockQuestions.filter(q => isQuestionInPopulationScope(q, scope));
            expect(visibleQuestions.length).toBe(2);
            expect(visibleQuestions.every(q => q.isCommon)).toBe(true);
        });

        it("Relationship A questionnaire resolves valid questions under Relationship A", () => {
            const scope: QuestionScope = {
                relationshipId: "eng-barclays",
                questionnaireId: "q-barclays-inst",
            };
            const visibleQuestions = mockQuestions.filter(q => isQuestionInPopulationScope(q, scope));
            expect(visibleQuestions.length).toBe(3);
        });

        it("Foreign Relationship B questionnaire yields 0 questions when combined with Relationship A scope", () => {
            const impossibleScope: QuestionScope = {
                relationshipId: "eng-barclays",
                questionnaireId: "q-riskbridge-inst",
            };
            const visibleQuestions = mockQuestions.filter(q => isQuestionInPopulationScope(q, impossibleScope));
            expect(visibleQuestions.length).toBe(0);
        });
    });

    describe("3. Supplier Workbench Scoping Contract", () => {
        const mockSupplierQuestions = [
            { clientLEName: "Client Alpha Limited", questionnaireName: "Alpha Onboarding QN" },
            { clientLEName: "Client Alpha Limited", questionnaireName: "Common Profile QN" },
            { clientLEName: "Client Beta Limited", questionnaireName: "Beta Proprietary QN" },
        ];

        it("under 'ALL' relationships: includes all questionnaires across all clients", () => {
            const list = deriveEligibleSupplierQuestionnaires(mockSupplierQuestions, "ALL");
            expect(list).toEqual([
                "Alpha Onboarding QN",
                "Beta Proprietary QN",
                "Common Profile QN",
            ]);
        });

        it("when scoped to 'Client Alpha Limited': includes only Alpha Onboarding QN and Common Profile QN", () => {
            const list = deriveEligibleSupplierQuestionnaires(mockSupplierQuestions, "Client Alpha Limited");
            expect(list).toEqual([
                "Alpha Onboarding QN",
                "Common Profile QN",
            ]);
            expect(list.includes("Beta Proprietary QN")).toBe(false);
        });

        it("when scoped to 'Client Beta Limited': includes only Beta Proprietary QN", () => {
            const list = deriveEligibleSupplierQuestionnaires(mockSupplierQuestions, "Client Beta Limited");
            expect(list).toEqual([
                "Beta Proprietary QN",
            ]);
            expect(list.includes("Alpha Onboarding QN")).toBe(false);
        });
    });
});
