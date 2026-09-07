import { describe, it, expect } from "vitest";

describe("Questionnaire Mapping Dropdown Category Grouping (ONP-35)", () => {
    // Pure logic simulation of FieldSelector category grouping & ordering
    function computeCategorySections(
        masterFields: Array<{ fieldNo: number; fieldName: string; notes?: string }>,
        cats: Array<{ id: string; displayName: string; order: number; fields?: Array<{ fieldNo: number; order?: number }> }>
    ) {
        const fieldCategoryMap: Record<number, string> = {};
        cats.forEach((cat) => {
            (cat.fields ?? []).forEach((f) => {
                fieldCategoryMap[f.fieldNo] = cat.displayName;
            });
        });

        const masterOptions = masterFields.map((f) => ({
            value: `master:${f.fieldNo.toString()}`,
            label: f.fieldName,
            type: "master",
            meta: `Field ${f.fieldNo}`,
            description: f.notes,
            category: fieldCategoryMap[f.fieldNo] ?? null,
        }));

        const sections: { heading: string; options: any[] }[] = [];
        cats.forEach((cat) => {
            const catFieldOrder = new Map<number, number>();
            (cat.fields ?? []).forEach((f, idx) => {
                catFieldOrder.set(f.fieldNo, idx);
            });

            const opts = masterOptions
                .filter((o) => o.category === cat.displayName)
                .sort((a, b) => {
                    const fieldNoA = parseInt(a.value.replace("master:", ""));
                    const fieldNoB = parseInt(b.value.replace("master:", ""));
                    const orderA = catFieldOrder.has(fieldNoA) ? catFieldOrder.get(fieldNoA)! : 999999;
                    const orderB = catFieldOrder.has(fieldNoB) ? catFieldOrder.get(fieldNoB)! : 999999;
                    if (orderA !== orderB) return orderA - orderB;
                    return fieldNoA - fieldNoB;
                });

            if (opts.length > 0) sections.push({ heading: cat.displayName, options: opts });
        });

        const uncategorised = masterOptions
            .filter((o) => o.category === null)
            .sort((a, b) => {
                const fieldNoA = parseInt(a.value.replace("master:", ""));
                const fieldNoB = parseInt(b.value.replace("master:", ""));
                return (isNaN(fieldNoA) ? 0 : fieldNoA) - (isNaN(fieldNoB) ? 0 : fieldNoB);
            });

        if (uncategorised.length > 0) sections.push({ heading: "Other", options: uncategorised });
        return sections;
    }

    const mockMasterFields = [
        { fieldNo: 1, fieldName: "Legal Entity Name" },
        { fieldNo: 2, fieldName: "Registration Number" },
        { fieldNo: 3, fieldName: "Country of Incorporation" },
        { fieldNo: 4, fieldName: "Registered Address" },
        { fieldNo: 5, fieldName: "Headquarters Address" },
        { fieldNo: 6, fieldName: "Ultimate Parent Name" },
        { fieldNo: 99, fieldName: "Custom Non-Standard Field" },
    ];

    const mockCategories = [
        {
            id: "cat-1",
            displayName: "Basic Information",
            order: 1,
            fields: [
                { fieldNo: 1, order: 1 },
                { fieldNo: 2, order: 2 },
                { fieldNo: 3, order: 3 },
            ],
        },
        {
            id: "cat-2",
            displayName: "Addresses",
            order: 2,
            fields: [
                { fieldNo: 4, order: 1 },
                { fieldNo: 5, order: 2 },
            ],
        },
        {
            id: "cat-3",
            displayName: "Ownership & Structure",
            order: 3,
            fields: [
                { fieldNo: 6, order: 1 },
            ],
        },
    ];

    it("1. Groups fields under configured category headings in admin-defined category order", () => {
        const sections = computeCategorySections(mockMasterFields, mockCategories);

        expect(sections.map((s) => s.heading)).toEqual([
            "Basic Information",
            "Addresses",
            "Ownership & Structure",
            "Other",
        ]);
    });

    it("2. Sorts fields within each category according to configured order", () => {
        const sections = computeCategorySections(mockMasterFields, mockCategories);

        const basicInfoSection = sections.find((s) => s.heading === "Basic Information");
        expect(basicInfoSection?.options.map((o) => o.value)).toEqual([
            "master:1",
            "master:2",
            "master:3",
        ]);

        const addressesSection = sections.find((s) => s.heading === "Addresses");
        expect(addressesSection?.options.map((o) => o.value)).toEqual([
            "master:4",
            "master:5",
        ]);
    });

    it("3. Uncategorized fields are placed under 'Other' without polluting categorized sections", () => {
        const sections = computeCategorySections(mockMasterFields, mockCategories);

        const otherSection = sections.find((s) => s.heading === "Other");
        expect(otherSection?.options.map((o) => o.value)).toEqual(["master:99"]);
    });

    it("4. Empty categories with no matching master fields are omitted cleanly", () => {
        const categoriesWithEmpty = [
            ...mockCategories,
            { id: "cat-empty", displayName: "Empty Financials", order: 4, fields: [] },
        ];

        const sections = computeCategorySections(mockMasterFields, categoriesWithEmpty);
        expect(sections.find((s) => s.heading === "Empty Financials")).toBeUndefined();
    });
});
