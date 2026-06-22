import { QuestionnairePDF } from './src/components/pdf/questionnaire-pdf';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';

async function test() {
  try {
    const qPdfElement = React.createElement(QuestionnairePDF, {
      title: "Test",
      exportMetadata: {
          exportId: "123",
          generatedAt: new Date().toISOString(),
          generatedBy: "Mark",
          clientDisplayName: "Client",
          supplierDisplayName: "Supplier",
          exportFormatVersion: "1.0",
          applicationVersion: "1.0"
      },
      data: []
    });

    const stream = await renderToStream(qPdfElement as any);
    console.log("Success!");
  } catch (e) {
    console.error("PDF ERROR:", e);
  }
}
test();
