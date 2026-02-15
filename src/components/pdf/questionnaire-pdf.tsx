import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// --- PDF Styles ---
const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
    title: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 12, marginBottom: 20, textAlign: 'center', color: '#666' },
    questionBlock: { marginBottom: 15, paddingBottom: 10, borderBottom: '1px solid #eee' },
    status: { fontSize: 8, color: '#999', marginBottom: 2 },
    question: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
    answer: { fontSize: 10, marginBottom: 5, color: '#333' },
    commentHeader: { fontSize: 9, fontStyle: 'italic', marginTop: 5, color: '#666' },
    comment: { fontSize: 9, color: '#666', marginLeft: 10 }
});

export interface QuestionnairePDFProps {
    data: {
        id: string;
        status: string;
        question: string;
        answer: string;
        notes?: string;
    }[];
    title: string;
}

// --- PDF Component ---
export const QuestionnairePDF = ({ data, title }: QuestionnairePDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Questionnaire Export</Text>
            {data.map((item, i) => (
                <View key={i} style={styles.questionBlock}>
                    <Text style={styles.status}>Status: {item.status}</Text>
                    <Text style={styles.question}>Q{i + 1}: {item.question}</Text>
                    <Text style={styles.answer}>Answer: {item.answer || "(No Answer)"}</Text>
                    {item.notes && item.notes.length > 0 && (
                        <View>
                            <Text style={styles.commentHeader}>Notes:</Text>
                            {item.notes.split('\n').map((note: string, j: number) => (
                                <Text key={j} style={styles.comment}>• {note}</Text>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </Page>
    </Document>
);
