import React from 'react';
import ReactPDF from '@react-pdf/renderer';
import { QuestionnairePDF } from '/opt/code/coparity/src/components/pdf/questionnaire-pdf';
import fs from 'fs';

const dummyData = [
    {
        id: "q1",
        status: "VERIFIED",
        question: "Sample LIST Group",
        answer: "Group Data",
        groupDisplayStyle: 'LIST' as const,
        groupFields: [
            { fieldNo: 1, label: "First Name", displayValue: "John", order: 1, sourceLabel: "User Input" },
            { fieldNo: 2, label: "Last Name", displayValue: "Doe", order: 2, sourceLabel: "User Input" }
        ]
    },
    {
        id: "q2",
        status: "VERIFIED",
        question: "Sample COMPACT Group",
        answer: "Group Data",
        groupDisplayStyle: 'COMPACT' as const,
        groupFields: [
            { fieldNo: 3, label: "Company Type", displayValue: "LTD", order: 1, sourceLabel: "Companies House" },
            { fieldNo: 4, label: "Status", displayValue: "Active", order: 2, sourceLabel: "Companies House" },
            { fieldNo: 5, label: "Incorporation Date", displayValue: "12 May 2020", order: 3, sourceLabel: "Companies House" },
            { fieldNo: 6, label: "Jurisdiction", displayValue: "GB", order: 4, sourceLabel: "Companies House" }
        ]
    },
    {
        id: "q3",
        status: "VERIFIED",
        question: "Sample GRID Group",
        answer: "Group Data",
        groupDisplayStyle: 'GRID' as const,
        groupFields: [
            { fieldNo: 7, label: "Primary Phone", displayValue: "+44 123 456 789", order: 1, sourceLabel: "Self Certified" },
            { fieldNo: 8, label: "Email Address", displayValue: "contact@example.com", order: 2, sourceLabel: "Self Certified" },
            { fieldNo: 9, label: "Website", displayValue: "https://example.com", order: 3, sourceLabel: "Self Certified" }
        ]
    }
];

const metadata = {
    exportId: "EXP-123",
    generatedAt: new Date().toISOString(),
    generatedBy: "System",
    exportFormatVersion: "1.0",
    applicationVersion: "1.0",
    summaryStats: {
        totalQuestions: 3,
        answered: 3,
        registrySourced: 1,
        userSupplied: 2,
        noResponse: 0
    }
};

async function generate() {
    await ReactPDF.render(
        <QuestionnairePDF title="Group Render Test" data={dummyData} exportMetadata={metadata as any} />,
        '/opt/code/coparity/test-groups.pdf'
    );
    console.log("PDF generated at /opt/code/coparity/test-groups.pdf");
}

generate().catch(console.error);
